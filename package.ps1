# Define the folder to zip (current folder)
$sourceFolder = Get-Location
$manifestPath = Join-Path $sourceFolder "manifest.json"

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

# Function to zip folder, excluding specific files and folders
function Zip-Folder {
    param (
        [string]$sourceFolder,
        [string]$zipFilePath
    )

    # Remove any existing zip file
    if (Test-Path $zipFilePath) {
        Remove-Item $zipFilePath
    }

    # Create a zip archive excluding zip files, .git, and .dist folders
    Compress-Archive -Path (Get-ChildItem -Path $sourceFolder -Recurse |
        Where-Object { 
            $_.FullName -notlike "*.zip" -and 
            $_.FullName -notlike "*\.git\*" -and
            $_.FullName -notlike "*\.dist\*" 
        }).FullName -DestinationPath $zipFilePath -Update
}

# Call the function to zip the current folder
Zip-Folder -sourceFolder $sourceFolder -zipFilePath $zipFilePath

Write-Host "Zipped folder successfully. Saved as $zipFilePath"
