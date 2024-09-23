console.log("ChatGPT Extension content script loaded successfully. Version 26");

let activeItemSelected = null; // Variable to store the GUID of the last clicked history item

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    waitForNavToLoad();
  });
} else {
  waitForNavToLoad();
}

function waitForNavToLoad() {
  const checkNavExistence = setInterval(() => {
    const targetDiv = document.querySelector("nav > div:nth-child(2) > div:nth-child(3) > div");
    if (targetDiv) {
      clearInterval(checkNavExistence);
      addPinnedSection(targetDiv);
      addMenuButtonListeners(); // Add click handlers after the pinned section is added
      observeForNewHistoryItems(); // Start observing for new history items
    }
  }, 500); // Check every 500ms until the nav structure is fully loaded
}

function addPinnedSection(targetDiv) {
  const pinnedSection = document.createElement("div");
  pinnedSection.classList.add("relative", "mt-5", "first:mt-0", "last:mb-5");
  pinnedSection.setAttribute("id", "pinned-section");
  pinnedSection.innerHTML = `
    <div class="sticky top-0 z-20 bg-token-sidebar-surface-primary">
      <span class="flex h-9 items-center">
        <h3 class="pb-2 pt-3 px-2 text-xs font-semibold text-ellipsis overflow-hidden break-all text-token-text-primary">Pinned</h3>
      </span>
    </div>
    <ol id="pinned-items-list">
      <!-- Pinned items will go here -->
    </ol>
  `;
  targetDiv.prepend(pinnedSection);

  // Load pinned items from local storage after the section is added
  loadPinnedItemsFromLocalStorage();
  togglePinnedSectionVisibility(); // Check and toggle pinned section visibility
}

// Function to toggle the visibility of the pinned section based on its content
function togglePinnedSectionVisibility() {
  const pinnedItems = JSON.parse(localStorage.getItem("pinnedItems")) || [];
  const pinnedSection = document.getElementById("pinned-section");

  if (pinnedItems.length === 0) {
    pinnedSection.style.display = "none"; // Hide the pinned section if no items
  } else {
    pinnedSection.style.display = "block"; // Show the pinned section if there are items
  }
}

// Function to add click listeners to buttons within the history items
function addMenuButtonListeners() {
  const historyItems = document.querySelectorAll("li[data-testid='history-item']");

  historyItems.forEach((item) => {
    const button = item.querySelector("button[aria-haspopup='menu']");
    const anchor = item.querySelector("a[href^='/c/']"); // Find the anchor sibling with the href

    if (button && anchor && !button.dataset.listenerAdded) {
      button.dataset.listenerAdded = "true"; // Prevent duplicate listeners

      // Add click event to the button
      button.addEventListener("click", () => {
        const href = anchor.getAttribute("href"); // Get the href attribute from the <a> tag
        const match = href.match(/\/c\/([a-f0-9\-]+)/); // Extract the GUID using regex

        if (match) {
          const clickedItem = match[1];

          // If the item is clicked again, clear activeItemSelected to handle re-clicks
          if (activeItemSelected === clickedItem) {
            activeItemSelected = null;
            console.log("Menu closed, active item cleared.");
          } else {
            activeItemSelected = clickedItem;
            console.log(`Active item selected: ${activeItemSelected}`);
          }

          // After the button click, find the menu by searching for the div with data-radix-popper-content-wrapper
          setTimeout(() => {
            const menuWrapper = document.querySelector("[data-radix-popper-content-wrapper]");
            if (menuWrapper) {
              const menuElement = menuWrapper.querySelector("div[role='menu']");
              if (menuElement) {
                addPinMenuItem(menuElement, menuWrapper); // Add Pin/Unpin without hiding the menu
              }
            }
          }, 50); // Add a small delay to ensure the menu is rendered
        } else {
          console.error("GUID not found in href");
        }
      });
    }
  });
}

// Function to add the "Pin/Unpin" menu item directly to the found menu
// Function to add the "Pin/Unpin" menu item directly to the found menu
function addPinMenuItem(menuElement, menuWrapper) {
  if (!activeItemSelected) {
    console.error("No active item selected, skipping Pin/Unpin creation");
    return; // No item selected, exit early
  }

  console.log("Adding Pin/Unpin for active item:", activeItemSelected);

  // Check if the menu already contains the pin/unpin item, if not, create it
  let pinMenuItem = menuElement.querySelector('.pin-unpin-menu-item');
  
  if (!pinMenuItem) {
    // Create the menu item container
    pinMenuItem = document.createElement("div");
    pinMenuItem.className =
      "pin-unpin-menu-item flex items-center m-1.5 p-2.5 text-sm cursor-pointer focus-visible:outline-0 group relative hover:bg-[#f5f5f5] rounded-md my-0 px-3 mx-2 dark:radix-state-open:bg-token-main-surface-secondary gap-2.5 py-3";
    pinMenuItem.setAttribute("role", "menuitem");
    pinMenuItem.setAttribute("tabindex", "-1");
    pinMenuItem.setAttribute("data-orientation", "vertical");

    // Create the icon container
    const iconContainer = document.createElement("div");
    iconContainer.className = "flex items-center justify-center text-token-text-secondary h-5 w-5";
    iconContainer.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#9E9E9E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="7" r="3"/>
        <line x1="12" y1="10" x2="12" y2="20"/>
        <line x1="10" y1="18" x2="14" y2="18"/>
      </svg>
    `;

    // Create the label for the menu item
    const label = document.createElement("div");
    pinMenuItem.appendChild(iconContainer);
    pinMenuItem.appendChild(label);

    // Insert the "Pin/Unpin" menu item at the top of the menu
    menuElement.insertBefore(pinMenuItem, menuElement.firstChild);

    // Add click event listener to handle pinning and unpinning
    pinMenuItem.addEventListener("click", () => {
      if (activeItemSelected) {
        if (label.textContent === "Pin") {
          moveHistoryItemByGuid(activeItemSelected); // Pin the item
          label.textContent = "Unpin"; // Change the label to Unpin
          console.log(`Pinned item with GUID: ${activeItemSelected}`);
        } else {
          unpinHistoryItemByGuid(activeItemSelected); // Unpin the item
          label.textContent = "Pin"; // Change the label to Pin
          console.log(`Unpinned item with GUID: ${activeItemSelected}`);
        }

        // Hide the context menu after the pin/unpin action
        if (menuWrapper) {
          menuWrapper.style.display = "none"; // Hide the context menu
          console.log("Hid the context menu.");
        }

        // Clear the active item after action is taken
        activeItemSelected = null;

        // Check the pinned section visibility after pin/unpin
        togglePinnedSectionVisibility();
      } else {
        alert("No item selected to pin or unpin.");
      }
    });
  }

  // Update the label dynamically based on whether the item is pinned or not
  const pinnedItems = JSON.parse(localStorage.getItem("pinnedItems")) || [];
  const label = pinMenuItem.querySelector("div:last-child"); // Get the label element
  if (pinnedItems.includes(activeItemSelected)) {
    label.textContent = "Unpin"; // If item is already pinned
    console.log("Item is pinned, showing Unpin");
  } else {
    label.textContent = "Pin"; // If item is not pinned
    console.log("Item is not pinned, showing Pin");
  }
}



// Load pinned items from local storage when the page loads
function loadPinnedItemsFromLocalStorage() {
  let pinnedItems = JSON.parse(localStorage.getItem("pinnedItems")) || [];

  pinnedItems.forEach(guid => {
    moveHistoryItemByGuid(guid);  // Move the pinned item to the pinned section
    console.log(`Loaded pinned item with GUID: ${guid} from local storage.`);
  });
}

// Function to move a specific history item based on the GUID
function moveHistoryItemByGuid(guid) {
  const historyItem = document.querySelector(`a[href='/c/${guid}']`);
  if (historyItem) {
    const historyListItem = historyItem.closest("li");
    const pinnedItemsList = document.getElementById("pinned-items-list");

    if (pinnedItemsList) {
      pinnedItemsList.appendChild(historyListItem);
      console.log(`Moved item with GUID: ${guid} to the pinned section.`);

      // Add the GUID to local storage
      let pinnedItems = JSON.parse(localStorage.getItem("pinnedItems")) || [];
      if (!pinnedItems.includes(guid)) {
        pinnedItems.push(guid);
        localStorage.setItem("pinnedItems", JSON.stringify(pinnedItems));
        console.log(`Saved pinned item with GUID: ${guid} to local storage.`);
      }

      // Reapply the event listeners to the newly moved item
      addMenuButtonListeners(); // Treat it as a new history item
    } else {
      console.error("Pinned section not found.");
    }
  } else {
    console.error(`No history item found with GUID: ${guid}`);
  }
}

// Function to unpin a specific history item based on the GUID
function unpinHistoryItemByGuid(guid) {
  const historyItem = document.querySelector(`a[href='/c/${guid}']`);

  if (historyItem) {
    const historyListItem = historyItem.closest("li");

    // Find the target list where unpinned items should go
    const targetList = document.querySelector("nav > div:nth-child(2) > div:nth-child(3) > div > div:nth-child(2) > ol");

    if (targetList) {
      // Insert the unpinned item at the top of the list (before the first item)
      targetList.insertBefore(historyListItem, targetList.firstChild);
      console.log(`Unpinned item with GUID: ${guid} and moved to the original section.`);

      // Remove the item from local storage
      let pinnedItems = JSON.parse(localStorage.getItem("pinnedItems")) || [];
      pinnedItems = pinnedItems.filter(item => item !== guid); // Remove the GUID from the list
      localStorage.setItem("pinnedItems", JSON.stringify(pinnedItems));
      console.log(`Removed item with GUID: ${guid} from local storage.`);

      // Reapply the event listeners to the unpinned item
      addMenuButtonListeners(); // Treat it as a new history item

      // Check the pinned section visibility after unpinning
      togglePinnedSectionVisibility();
    } else {
      console.error("Target list not found for unpinned items.");
    }
  } else {
    console.error(`No history item found with GUID: ${guid}`);
  }
}

// Observe new history items being dynamically added to the page
function observeForNewHistoryItems() {
  const bodyElement = document.querySelector("body");

  const observerForHistoryItems = new MutationObserver(() => {
    addMenuButtonListeners(); // Add click listeners to new history items
  });

  observerForHistoryItems.observe(bodyElement, { childList: true, subtree: true });
}
