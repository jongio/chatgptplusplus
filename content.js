console.log("ChatGPT Extension content script loaded successfully. Version 26");

let activeItemSelected = null; // Variable to store the GUID of the last clicked history item
console.log("Initialized activeItemSelected to null");

const observer = new MutationObserver((mutationsList) => {
  console.log(`MutationObserver triggered with ${mutationsList.length} mutations`);
  mutationsList.forEach((mutation, index) => {
    console.log(`Processing mutation ${index + 1}/${mutationsList.length}:`, mutation);
    
    // Check if the target element is added
    let targetDiv = document.querySelector('nav > div:nth-child(2) > div:nth-child(3) > div');
    if (targetDiv && !document.getElementById('pinned-section')) {
      console.log('Target element found, adding pinned section...');
      addPinnedSection(targetDiv); // Function to add the pinned section
    }

    // Check if the target element has been removed
    mutation.removedNodes.forEach((removedNode, removedIndex) => {
      console.log(`Checking removed node ${removedIndex + 1}/${mutation.removedNodes.length}:`, removedNode);
      if (removedNode.querySelector && removedNode.querySelector('nav > div:nth-child(2) > div:nth-child(3) > div')) {
        console.log('Target element removed, waiting for re-addition...');
        // Start observing the document for the re-addition of the target element
        const reAddObserver = new MutationObserver((reMutationsList) => {
          console.log(`reAddObserver triggered with ${reMutationsList.length} mutations`);
          reMutationsList.forEach((reMutation, reIndex) => {
            console.log(`Processing re-add mutation ${reIndex + 1}/${reMutationsList.length}:`, reMutation);
            const readdedDiv = document.querySelector('nav > div:nth-child(2) > div:nth-child(3) > div');
            if (readdedDiv && !document.getElementById('pinned-section')) {
              console.log('Target element re-added, adding pinned section...');
              addPinnedSection(readdedDiv); // Re-add the pinned section
              reAddObserver.disconnect(); // Stop observing once it's re-added
              console.log('reAddObserver disconnected');
            }
          });
        });
        // Start observing the document's body for re-addition
        reAddObserver.observe(document.body, { childList: true, subtree: true });
        console.log('Started reAddObserver to watch for target element re-addition');
      }
    });

    // Check for added or removed `li` elements with data-testid^='history-item'
    mutation.addedNodes.forEach((addedNode, addedIndex) => {
      console.log(`Checking added node ${addedIndex + 1}/${mutation.addedNodes.length}:`, addedNode);
      if (addedNode.nodeType === 1) { // Ensure it's an element node
        if (addedNode.matches && addedNode.matches("li[data-testid^='history-item']")) {
          console.log('New history item added, attaching menu button listeners...');
          addMenuButtonListeners(); // Call to add listeners
        }
      }
    });

    mutation.removedNodes.forEach((removedNode, removedIndex) => {
      console.log(`Checking removed node ${removedIndex + 1}/${mutation.removedNodes.length}:`, removedNode);
      // Additional logging can be added here if needed
    });
  });
});

// Start observing the document's body for child elements being added or removed
observer.observe(document.body, { childList: true, subtree: true });
console.log("Started MutationObserver on document.body");


// Function to add the pinned section (if not already added)
function addPinnedSection(targetDiv) {
  console.log("addPinnedSection called with targetDiv:", targetDiv);
  if (document.getElementById("pinned-section")) {
    console.log("Pinned section already exists. Exiting addPinnedSection.");
    return; // Ensure not to add the pinned section more than once
  }
  
  try {
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
    console.log("Pinned section element created and prepended to targetDiv");

    // Load pinned items from local storage after the section is added
    loadPinnedItemsFromLocalStorage();
    togglePinnedSectionVisibility(); // Check and toggle pinned section visibility
    console.log("Called loadPinnedItemsFromLocalStorage and togglePinnedSectionVisibility");
  } catch (error) {
    console.error("Error in addPinnedSection:", error);
  }
}


// Function to toggle the visibility of the pinned section based on its content
function togglePinnedSectionVisibility() {
  console.log("togglePinnedSectionVisibility called");
  try {
    const pinnedItems = JSON.parse(localStorage.getItem("pinnedItems")) || [];
    console.log(`Retrieved pinnedItems from localStorage:`, pinnedItems);
    const pinnedSection = document.getElementById("pinned-section");

    if (!pinnedSection) {
      console.warn("Pinned section not found when trying to toggle visibility.");
      return;
    }

    if (pinnedItems.length === 0) {
      pinnedSection.style.display = "none"; // Hide the pinned section if no items
      console.log("No pinned items. Hiding pinned section.");
    } else {
      pinnedSection.style.display = "block"; // Show the pinned section if there are items
      console.log("Pinned items exist. Showing pinned section.");
    }
  } catch (error) {
    console.error("Error in togglePinnedSectionVisibility:", error);
  }
}


// Function to add click listeners to the grandparent of buttons within the history items
function addMenuButtonListeners() {
  console.log("addMenuButtonListeners called");
  try {
    const historyItems = document.querySelectorAll("li[data-testid^='history-item']");
    console.log(`Found ${historyItems.length} history items`);

    historyItems.forEach((item, index) => {
      const anchor = item.querySelector("a[href^='/c/']"); // Find the anchor sibling with the href
      const grandparent = anchor?.parentElement?.parentElement; // Get the grandparent node

      if (grandparent && anchor && !grandparent.dataset.listenerAdded) {
        grandparent.dataset.listenerAdded = "true"; // Prevent duplicate listeners
        console.log(`Attaching click listener to history item ${index + 1}`);

        // Add click event to the grandparent node
        grandparent.addEventListener("click", (event) => {
          console.log(`History item clicked:`, event.currentTarget);
          const href = anchor.getAttribute("href"); // Get the href attribute from the <a> tag
          console.log(`Extracted href: ${href}`);
          const match = href.match(/\/c\/([a-f0-9\-]+)/); // Extract the GUID using regex

          if (match) {
            const clickedItem = match[1];
            console.log(`Extracted GUID: ${clickedItem}`);

            // If the item is clicked again, clear activeItemSelected to handle re-clicks
            if (activeItemSelected === clickedItem) {
              activeItemSelected = null;
              console.log("Menu closed, active item cleared.");
            } else {
              activeItemSelected = clickedItem;
              console.log(`Active item selected: ${activeItemSelected}`);
            }

            setTimeout(() => {
              const menuWrapper = document.querySelector("[data-radix-popper-content-wrapper]");
              if (menuWrapper) {
                console.log("Menu wrapper found:", menuWrapper);
                const menuElement = menuWrapper.querySelector("div[role='menu']");
                if (menuElement) {
                  console.log("Menu element found, adding Pin/Unpin menu item");
                  addPinMenuItem(menuElement, menuWrapper); // Add Pin/Unpin without hiding the menu
                } else {
                  console.warn("Menu element with role='menu' not found within menuWrapper");
                }
              } else {
                console.warn("Menu wrapper not found in the DOM");
              }
            }, 50); // Add a small delay to ensure the menu is rendered
          } else {
            console.error("GUID not found in href:", href);
          }
        });
      } else if (!grandparent) {
        console.warn(`Grandparent element not found for history item ${index + 1}`);
      } else if (!anchor) {
        console.warn(`Anchor element not found for history item ${index + 1}`);
      } else {
        console.log(`Click listener already added to history item ${index + 1}`);
      }
    });
  } catch (error) {
    console.error("Error in addMenuButtonListeners:", error);
  }
}


// Function to add the "Pin/Unpin" menu item directly to the found menu
function addPinMenuItem(menuElement, menuWrapper) {
  console.log("addPinMenuItem called with menuElement and menuWrapper");
  if (!activeItemSelected) {
    console.error("No active item selected, skipping Pin/Unpin creation");
    return; // No item selected, exit early
  }

  console.log("Adding Pin/Unpin for active item:", activeItemSelected);

  try {
    // Check if the menu already contains the pin/unpin item, if not, create it
    let pinMenuItem = menuElement.querySelector('.pin-unpin-menu-item');
    
    if (!pinMenuItem) {
      console.log("Pin/Unpin menu item not found. Creating a new one.");
      // Create the menu item container
      pinMenuItem = document.createElement("div");
      pinMenuItem.className =
        "pin-unpin-menu-item flex items-center m-1.5 p-2.5 text-sm cursor-pointer focus-visible:outline-0 radix-disabled:pointer-events-none radix-disabled:opacity-50 group relative hover:bg-[#f5f5f5] focus-visible:bg-[#f5f5f5] radix-state-open:bg-[#f5f5f5] dark:hover:bg-token-main-surface-secondary dark:focus-visible:bg-token-main-surface-secondary rounded-md my-0 px-3 mx-2 dark:radix-state-open:bg-token-main-surface-secondary gap-2.5 py-3";
      pinMenuItem.setAttribute("role", "menuitem");
      pinMenuItem.setAttribute("tabindex", "-1");
      pinMenuItem.setAttribute("data-orientation", "vertical");
      pinMenuItem.setAttribute("data-radix-collection-item", "");

      // Create the icon container
      const iconContainer = document.createElement("div");
      iconContainer.className = "flex items-center justify-center text-token-text-secondary h-5 w-5";

      // Create the label for the menu item
      const label = document.createElement("div");

      // Insert the "Pin" icon or "Unpin" icon depending on whether the item is pinned
      const pinnedItems = JSON.parse(localStorage.getItem("pinnedItems")) || [];
      if (pinnedItems.includes(activeItemSelected)) {
        label.textContent = "Unpin"; // If item is already pinned
        iconContainer.innerHTML = unpinIcon(); // Insert the Unpin icon
        console.log("Item is pinned, showing Unpin");
      } else {
        label.textContent = "Pin"; // If item is not pinned
        iconContainer.innerHTML = pinIcon(); // Insert the Pin icon
        console.log("Item is not pinned, showing Pin");
      }

      // Add the iconContainer and label to the pinMenuItem
      pinMenuItem.appendChild(iconContainer);
      pinMenuItem.appendChild(label);

      // Insert the "Pin/Unpin" menu item at the top of the menu
      menuElement.insertBefore(pinMenuItem, menuElement.firstChild);
      console.log("Pin/Unpin menu item inserted into the menu");

      // Add click event listener to handle pinning and unpinning
      pinMenuItem.addEventListener("click", () => {
        console.log("Pin/Unpin menu item clicked");
        if (activeItemSelected) {
          if (label.textContent === "Pin") {
            console.log(`Pin action initiated for GUID: ${activeItemSelected}`);
            moveHistoryItemByGuid(activeItemSelected); // Pin the item
            label.textContent = "Unpin"; // Change the label to Unpin
            iconContainer.innerHTML = unpinIcon(); // Switch to Unpin icon
            console.log(`Pinned item with GUID: ${activeItemSelected}`);
          } else {
            console.log(`Unpin action initiated for GUID: ${activeItemSelected}`);
            unpinHistoryItemByGuid(activeItemSelected); // Unpin the item
            label.textContent = "Pin"; // Change the label to Pin
            iconContainer.innerHTML = pinIcon(); // Switch to Pin icon
            console.log(`Unpinned item with GUID: ${activeItemSelected}`);
          }

          // Hide the context menu after the pin/unpin action
          if (menuWrapper) {
            menuWrapper.style.display = "none"; // Hide the context menu
            console.log("Hid the context menu.");
          } else {
            console.warn("menuWrapper not found when trying to hide the context menu.");
          }

          // Clear the active item after action is taken
          activeItemSelected = null;
          console.log("Cleared activeItemSelected after pin/unpin action");

          // Check the pinned section visibility after pin/unpin
          togglePinnedSectionVisibility();
          console.log("Called togglePinnedSectionVisibility after pin/unpin");

          // Remove the specific div and span elements
          //clearRadixPopperAndFocusGuards();
          console.log("Optionally clearing Radix popper and focus guards (commented out)");
        } else {
          console.warn("No item selected to pin or unpin.");
          alert("No item selected to pin or unpin.");
        }
      });
    } else {
      console.log("Pin/Unpin menu item already exists. Skipping creation.");
    }
  } catch (error) {
    console.error("Error in addPinMenuItem:", error);
  }
}


// Function for Pin icon SVG
function pinIcon() {
  console.log("pinIcon called");
  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" class="h-5 w-5 shrink-0">
    <g transform="translate(3, 3) scale(0.0185)">
      <path fill-rule="evenodd" clip-rule="evenodd" fill="currentColor" stroke-width="3px" d="M384.5,59.6c15.5-31,45-52.6,79.2-58.2,34.2-5.6,69,5.6,93.6,30.1l219.2,218.7c24.5,24.6,35.7,59.4,30.1,93.6-5.6,34.2-27.2,63.7-58.2,79.2l-186.8,94c-17.7,8.8-31.5,23.8-38.9,42.1l-77.2,194.9c-6.8,16.9-21.6,29.2-39.5,32.8-17.8,3.6-36.3-2.1-49.1-15l-140.9-142-178.2,178.2H0v-37.8l178.2-178.2L36.7,451.1c-12.9-12.9-18.5-31.4-14.8-49.3,3.7-17.9,16.2-32.6,33.2-39.3l193.3-77.2c18.4-7.6,33.5-21.6,42.1-38.9l93.4-186.8h.5ZM519.5,69.3c-12.3-12.2-29.7-17.8-46.8-15.1-17.1,2.8-31.8,13.6-39.6,29.1l-93.4,186.8c-14.9,29.5-40,52.6-70.7,64.8l-193.9,78.3,320.2,320.2,77.2-193.9c12.3-30.5,35.4-55.5,64.8-70.2l186.8-94c15.5-7.8,26.3-22.5,29.1-39.6,2.8-17.1-2.8-34.5-15.1-46.8l-218.7-219.2v-.5Z"/>
    </g>
  </svg>
  `;
}

function unpinIcon() {
  console.log("unpinIcon called");
  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" class="h-5 w-5 shrink-0">
    <g transform="translate(3, 3) scale(0.015)">
      <path fill-rule="evenodd" clip-rule="evenodd" fill="currentColor" stroke-width="3px" d="M156.06,118.8c-6.34-8.45-17.02-12.43-27.35-10.18-10.32,2.25-18.39,10.31-20.63,20.63-2.25,10.32,1.73,21.01,10.18,27.35l256.5,256.5-155.52,62.1c-16.98,6.66-29.45,21.45-33.16,39.31-3.7,17.86,1.86,36.39,14.8,49.25l141.48,140.94-178.2,178.2v37.8h37.8l178.2-178.2,140.94,141.48c12.86,12.93,31.39,18.5,49.25,14.8,17.86-3.7,32.65-16.17,39.31-33.16l62.1-155.52,256.5,256.5c10.75,8.06,25.79,6.99,35.29-2.51,9.5-9.5,10.57-24.54,2.51-35.29L156.06,118.8ZM630.18,668.52l-70.74,177.12-320.22-320.22,177.12-70.2,213.84,213.3ZM702,581.04l-4.32,2.16,39.96,40.5,174.96-87.48c30.99-15.54,52.64-45.01,58.2-79.22,5.56-34.22-5.64-69.03-30.12-93.58l-218.7-219.24c-24.55-24.48-59.36-35.68-93.58-30.12-34.22,5.56-63.69,27.21-79.22,58.2l-88.02,174.96,40.5,39.96,2.16-4.32,93.42-186.3c7.77-15.5,22.5-26.32,39.61-29.1,17.11-2.78,34.51,2.82,46.79,15.06l218.7,218.7c12.24,12.28,17.84,29.68,15.06,46.79-2.78,17.11-13.6,31.84-29.1,39.61l-186.3,93.42Z"/>
    </g>
  </svg>
  `;
}



function clearRadixPopperAndFocusGuards() {
  console.log("clearRadixPopperAndFocusGuards called");
  try {
    const radixPopperDiv = document.querySelector("div[data-radix-popper-content-wrapper]");
    const radixFocusGuardSpans = document.querySelectorAll("span[data-radix-focus-guard]");

    // Check if the div exists and is not null
    if (radixPopperDiv) {
      radixPopperDiv.innerHTML = "";
      console.log("Cleared the contents of the div with data-radix-popper-content-wrapper.");
    } else {
      console.log("No div with data-radix-popper-content-wrapper found.");
    }

    // Check if the spans exist and are not null
    if (radixFocusGuardSpans.length > 0) {
      radixFocusGuardSpans.forEach((span, index) => {
        span.innerHTML = "";
        console.log(`Cleared the contents of span ${index + 1} with data-radix-focus-guard.`);
      });
    } else {
      console.log("No spans with data-radix-focus-guard found.");
    }
  } catch (error) {
    console.error("Error in clearRadixPopperAndFocusGuards:", error);
  }
}



// Load pinned items from local storage when the page loads
function loadPinnedItemsFromLocalStorage() {
  console.log("loadPinnedItemsFromLocalStorage called");
  try {
    let pinnedItems = JSON.parse(localStorage.getItem("pinnedItems")) || [];
    console.log(`Loaded pinnedItems from localStorage:`, pinnedItems);

    pinnedItems.forEach((guid, index) => {
      console.log(`Loading pinned item ${index + 1}/${pinnedItems.length} with GUID: ${guid}`);
      moveHistoryItemByGuid(guid);  // Move the pinned item to the pinned section
      console.log(`Loaded pinned item with GUID: ${guid} from local storage.`);
    });
  } catch (error) {
    console.error("Error in loadPinnedItemsFromLocalStorage:", error);
  }
}


// Function to move a specific history item based on the GUID
function moveHistoryItemByGuid(guid) {
  console.log(`moveHistoryItemByGuid called with GUID: ${guid}`);
  try {
    const historyItem = document.querySelector(`a[href='/c/${guid}']`);
    if (historyItem) {
      const historyListItem = historyItem.closest("li");
      const pinnedItemsList = document.getElementById("pinned-items-list");

      if (historyListItem && pinnedItemsList) {
        pinnedItemsList.appendChild(historyListItem);
        console.log(`Moved item with GUID: ${guid} to the pinned section.`);

        // Add the GUID to local storage
        let pinnedItems = JSON.parse(localStorage.getItem("pinnedItems")) || [];
        if (!pinnedItems.includes(guid)) {
          pinnedItems.push(guid);
          localStorage.setItem("pinnedItems", JSON.stringify(pinnedItems));
          console.log(`Saved pinned item with GUID: ${guid} to local storage.`);
        } else {
          console.log(`GUID: ${guid} is already in local storage.`);
        }

        // Reapply the event listeners to the newly moved item
        //addMenuButtonListeners(); // Treat it as a new history item
        console.log("Reapplied event listeners to the newly moved pinned item (if necessary).");
      } else {
        if (!historyListItem) {
          console.error(`Could not find the closest <li> for history item with GUID: ${guid}`);
        }
        if (!pinnedItemsList) {
          console.error("Pinned items list element with ID 'pinned-items-list' not found.");
        }
      }
    } else {
      console.error(`No history item found with GUID: ${guid}`);
    }
  } catch (error) {
    console.error(`Error in moveHistoryItemByGuid for GUID ${guid}:`, error);
  }
}


// Function to unpin a specific history item based on the GUID
function unpinHistoryItemByGuid(guid) {
  console.log(`unpinHistoryItemByGuid called with GUID: ${guid}`);
  try {
    const historyItem = document.querySelector(`a[href='/c/${guid}']`);

    if (historyItem) {
      const historyListItem = historyItem.closest("li");

      // Find the target list where unpinned items should go
      const targetList = document.querySelector("nav > div:nth-child(2) > div:nth-child(3) > div > div:nth-child(2) > ol");

      if (historyListItem && targetList) {
        // Insert the unpinned item at the top of the list (before the first item)
        targetList.insertBefore(historyListItem, targetList.firstChild);
        console.log(`Unpinned item with GUID: ${guid} and moved to the original section.`);

        // Remove the item from local storage
        let pinnedItems = JSON.parse(localStorage.getItem("pinnedItems")) || [];
        const initialLength = pinnedItems.length;
        pinnedItems = pinnedItems.filter(item => item !== guid); // Remove the GUID from the list
        if (pinnedItems.length < initialLength) {
          localStorage.setItem("pinnedItems", JSON.stringify(pinnedItems));
          console.log(`Removed item with GUID: ${guid} from local storage.`);
        } else {
          console.warn(`GUID: ${guid} was not found in local storage.`);
        }

        // Reapply the event listeners to the unpinned item
        //addMenuButtonListeners(); // Treat it as a new history item
        console.log("Reapplied event listeners to the unpinned item (if necessary).");

        // Check the pinned section visibility after unpinning
        togglePinnedSectionVisibility();
        console.log("Called togglePinnedSectionVisibility after unpinning.");
      } else {
        if (!historyListItem) {
          console.error(`Could not find the closest <li> for history item with GUID: ${guid}`);
        }
        if (!targetList) {
          console.error("Target list for unpinned items not found.");
        }
      }
    } else {
      console.error(`No history item found with GUID: ${guid}`);
    }
  } catch (error) {
    console.error(`Error in unpinHistoryItemByGuid for GUID ${guid}:`, error);
  }
}
