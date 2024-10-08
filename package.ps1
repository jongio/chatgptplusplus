# Load the necessary assembly if not already loaded
Add-Type -AssemblyName "System.IO.Compression.FileSystem"

# Define the folder to zip (current folder)
$sourceFolder = (Get-Location).Path
$manifestPath = Join-Path $sourceFolder "manifest.json"
$packageIgnorePath = Join-Path $sourceFolder ".packageignore"

# Read the version from manifest.json
$manifest = Get-Content $manifestPath | ConvertFrom-Json
$version = $manifest.version

# Define the dist folder and zip file name
$distFolder = Join-Path $sourceFolder ".dist"
$zipFileName = "chatgptplusplus-$version.zip"
$zipFilePath = Join-Path $distFolder $zipFileName

# Create the .dist folder if it doesn't exist
if (-not (Test-Path $distFolder)) {
    New-Item -Path $distFolder -ItemType Directory | Out-Null
}

# Function to read and parse .packageignore file
function Get-PackageIgnorePatterns {
    param (
        [string]$packageIgnorePath
    )
    $patterns = @()

    if (Test-Path $packageIgnorePath) {
        $lines = Get-Content $packageIgnorePath
        foreach ($line in $lines) {
            # Skip comments and empty lines
            if ($line -and $line -notmatch '^#' -and $line.Trim() -ne '') {
                # Convert folder patterns like "folder/" to regex
                if ($line.EndsWith('/')) {
                    # Allow both forward and backslashes
                    $patterns += "^" + [Regex]::Escape($line.TrimEnd('/')) + "([\\/]|$)"
                } elseif ($line.Contains('*')) {
                    # Convert wildcard patterns like "*.ps1" to regex
                    $escapedPattern = [Regex]::Escape($line).Replace('\*', '.*')
                    $patterns += "^" + $escapedPattern + "$"
                } else {
                    # Treat as exact match for files or folders
                    $patterns += "^" + [Regex]::Escape($line) + "$"
                }
            }
        }
    }
    return $patterns
}

# Function to check if a file or directory should be excluded based on the patterns
function Should-Exclude {
    param (
        [string]$filePath,
        [array]$excludePatterns
    )

    foreach ($pattern in $excludePatterns) {
        if ($filePath -match $pattern) {
            return $true
        }
    }
    return $false
}

# Function to zip folder while preserving full paths and excluding files/folders matching .packageignore patterns
function Zip-Folder {
    param (
        [string]$sourceFolder,
        [string]$zipFilePath,
        [array]$excludePatterns
    )

    # Remove any existing zip file
    if (Test-Path $zipFilePath) {
        Remove-Item $zipFilePath
    }

    # Open a new zip archive for writing
    $zipArchive = [System.IO.Compression.ZipFile]::Open($zipFilePath, [System.IO.Compression.ZipArchiveMode]::Create)

    try {
        # Recursively collect files and directories to zip, excluding those that match the .packageignore patterns
        $filesToZip = Get-ChildItem -Path $sourceFolder -Recurse -Force | Where-Object {
            # Calculate the relative path
            $fileRelativePath = $_.FullName.Substring($sourceFolder.Length + 1).TrimStart('\')

            # Normalize to use forward slashes
            $fileRelativePath = $fileRelativePath -replace '\\', '/'

            # Check if the file or folder matches any exclusion pattern
            -not (Should-Exclude -filePath $fileRelativePath -excludePatterns $excludePatterns)
        }

        # Add files and directories to the zip while preserving relative paths
        foreach ($file in $filesToZip) {
            $relativePath = $file.FullName.Substring($sourceFolder.Length + 1).TrimStart('\') -replace '\\', '/' # Normalize path

            if ($file.PSIsContainer) {
                # If it's a directory, create an empty directory in the zip
                if (-not $relativePath.EndsWith('/')) {
                    $relativePath += '/'
                }
                $zipArchive.CreateEntry($relativePath)
            } else {
                # Add files to the zip
                [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zipArchive, $file.FullName, $relativePath, [System.IO.Compression.CompressionLevel]::Optimal)
            }
        }
    }
    finally {
        # Close the zip archive
        $zipArchive.Dispose()
    }
}

# Get exclusion patterns from the .packageignore file
$excludePatterns = Get-PackageIgnorePatterns -packageIgnorePath $packageIgnorePath

# Call the function to zip the current folder with exclusions while preserving paths
Zip-Folder -sourceFolder $sourceFolder -zipFilePath $zipFilePath -excludePatterns $excludePatterns

Write-Host "Zipped folder successfully. Saved as $zipFilePath"
