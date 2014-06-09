(function () {
    "use strict";

    var appViewState = Windows.UI.ViewManagement.ApplicationViewState;
    var nav = WinJS.Navigation;
    var ui = WinJS.UI;
    var utils = WinJS.Utilities;

    var localSettings = Windows.Storage.ApplicationData.current.localSettings;
    var item = null;
    var currentViewState = null;

    var showFileNameExtensionsStyle = {
        true: {
            display: "inline",
            visibility: "visible"
        },
        false: {
            display: "none",
            visibility: "hidden"
        }
    };

    WinJS.UI.Pages.define("/pages/itemDetail/itemDetail.html", {
        /// <field type="WinJS.Binding.List" />

        // This function is called whenever a user navigates to this page. It
        // populates the page elements with the app's data.
        ready: function (element, options) {
            item = options.item;

            var titleElement = element.querySelector("header[role=banner] .pagetitle");
            titleElement.textContent = item.displayName;

            // Define the header menu
            initHeaderMenu();

            // Define appBar
            initAppBar();

            var listView = element.querySelector(".itemdetaillist").winControl;
            listView.oniteminvoked = this._itemInvoked.bind(this);

            this._initializeLayout(listView, Windows.UI.ViewManagement.ApplicationView.value);
            listView.element.focus();

            if (localSettings.values["startOn"] !== "custom") {
                Data.getPersistenceGroup("favorites").addOrReplace("startOn", item);
            }

            // Enable share as a source
            var dataTransferManager = Windows.ApplicationModel.DataTransfer.DataTransferManager.getForCurrentView();
            dataTransferManager.addEventListener("datarequested", dataRequested);

            window.addEventListener("focus", onWindowActivated, false);
            window.addEventListener("blur", onWindowDeactivated, false);
        },

        unload: function () {
            window.removeEventListener("focus", onWindowActivated, false);
            window.removeEventListener("blur", onWindowDeactivated, false);

            // Disable share as a source
            var dataTransferManager = Windows.ApplicationModel.DataTransfer.DataTransferManager.getForCurrentView();
            dataTransferManager.removeEventListener("datarequested", dataRequested);
        },

        // This function updates the page layout in response to viewState changes.
        updateLayout: function (element, viewState, lastViewState) {
            /// <param name="element" domElement="true" />

            var listView = element.querySelector(".itemdetaillist").winControl;
            if (lastViewState !== viewState) {
                if (lastViewState === appViewState.snapped || viewState === appViewState.snapped) {
                    var handler = function (e) {
                        listView.removeEventListener("contentanimating", handler, false);
                        e.preventDefault();
                    }
                    listView.addEventListener("contentanimating", handler, false);
                    this._initializeLayout(listView, viewState);
                }
            }
        },

        // This function updates the ListView with new layouts
        _initializeLayout: function (listView, viewState) {
            /// <param name="listView" value="WinJS.UI.ListView.prototype" />

            try {
                var sdsQuery = item.createItemQuery();
                var sdsOptions = {
                    mode: Windows.Storage.FileProperties.ThumbnailMode.listView,
                    requestedThumbnailSize: 200,
                    thumbnailOptions: Windows.Storage.FileProperties.ThumbnailOptions.useCurrentScale
                };

                listView.itemDataSource = new ui.StorageDataSource(sdsQuery, sdsOptions);
                listView.itemTemplate = sdsItemTemplate;
                if (viewState === appViewState.snapped) {
                    listView.layout = new ui.ListLayout();

                    document.getElementById("goToMenuItem").disabled = true;
                } else {
                    listView.layout = new ui.GridLayout();

                    document.getElementById("goToMenuItem").disabled = false;
                }
                currentViewState = viewState;

                // Add appBar event listener and display/hide it and the items
                listView.addEventListener("selectionchanged", doSelectItem);
                doSelectItem();
            } catch (error) {
                var message = "The folder \"" + item.displayName + "\" could not be accessed. Verify it exists and you have access to it";
                errorToast("Open folder", message);
                nav.back().done(function (wasSuccessful) {
                    if (!wasSuccessful) {
                        goToSection("home");
                    }
                });
            }

            function sdsItemTemplate(itemPromise, elementTemplate) {
                if (!elementTemplate) {
                    var viewDetailsValue = (localSettings.values["viewThumbnails"]) ? "" : "-details";

                    var itemTemplate = document.createElement("div");
                    itemTemplate.className = "itemtemplate";

                    var itemDiv = document.createElement("div");
                    itemDiv.className = "item" + viewDetailsValue;
                    new WinJS.UI.Tooltip(itemDiv);
                    itemTemplate.appendChild(itemDiv);

                    var imageImg = document.createElement("img");
                    imageImg.className = "item-image" + viewDetailsValue;
                    itemDiv.appendChild(imageImg);

                    var overlayDiv = document.createElement("div");
                    overlayDiv.className = "item-overlay" + viewDetailsValue;
                    itemDiv.appendChild(overlayDiv);

                    var titleH4 = document.createElement("h4");
                    titleH4.className = "item-title" + viewDetailsValue;
                    overlayDiv.appendChild(titleH4);

                    var nameSpan = document.createElement("span");
                    nameSpan.className = "item-name" + viewDetailsValue;
                    titleH4.appendChild(nameSpan);

                    var extensionSpan = document.createElement("span");
                    extensionSpan.className = "item-extension" + viewDetailsValue;
                    titleH4.appendChild(extensionSpan);

                    var typeH4 = document.createElement("h4");
                    typeH4.className = "item-type" + viewDetailsValue;
                    overlayDiv.appendChild(typeH4);

                    var sizeH4 = document.createElement("h4");
                    sizeH4.className = "item-size" + viewDetailsValue;
                    overlayDiv.appendChild(sizeH4);

                    var dateModifiedH4 = document.createElement("h4");
                    dateModifiedH4.className = "item-datemodified" + viewDetailsValue;
                    overlayDiv.appendChild(dateModifiedH4);

                    elementTemplate = itemTemplate;
                }

                return {
                    element: elementTemplate,
                    renderComplete: itemPromise.then(function (itemElement) {
                        var itemData = itemElement.data;
                        var viewDetailsValue = (localSettings.values["viewThumbnails"]) ? "" : "-details";

                        var nameElement = elementTemplate.querySelector(".item-name" + viewDetailsValue);
                        nameElement.innerText = itemData.displayName;

                        if (itemData.isOfType(Windows.Storage.StorageItemTypes.file)) {
                            var extensionElement = elementTemplate.querySelector(".item-extension" + viewDetailsValue);
                            extensionElement.innerText = itemData.fileType;

                            var showFileNameExtensionsValue = localSettings.values["showFileNameExtensions"];
                            extensionElement.style.display = showFileNameExtensionsStyle[showFileNameExtensionsValue].display;
                            extensionElement.style.visibility = showFileNameExtensionsStyle[showFileNameExtensionsValue].visibility;
                        }

                        var typeElement = elementTemplate.querySelector(".item-type" + viewDetailsValue);
                        typeElement.innerText = itemData.displayType;

                        var itemElement2 = elementTemplate.querySelector(".item" + viewDetailsValue);
                        var itemElement2Control = itemElement2.winControl;
                        itemElement2Control.innerHTML = itemData.name;
                        itemElement2Control.innerHTML += "<br />Type: " + itemData.displayType;
                        itemElement2.alt = itemData.fileType;

                        return itemElement.ready;
                    }).then(function (itemElement) {
                        var itemData = itemElement.data;
                        var viewDetailsValue = (localSettings.values["viewThumbnails"]) ? "" : "-details";

                        var imageElement = elementTemplate.querySelector(".item-image" + viewDetailsValue);
                        imageElement.alt = itemElement.data.name;
                        if (itemElement.data.isOfType(Windows.Storage.StorageItemTypes.file)) {
                            ui.StorageDataSource.loadThumbnail(itemElement, imageElement);
                        } else {
                            imageElement.src = Data.getFolderThumbnail();
                        }

                        return itemData.getBasicPropertiesAsync();
                    }).done(function (itemBasicProperties) {
                        var viewDetailsValue = (localSettings.values["viewThumbnails"]) ? "" : "-details";

                        var itemElement2 = elementTemplate.querySelector(".item" + viewDetailsValue);
                        var itemElement2Control = itemElement2.winControl;

                        if (itemElement2.alt) {
                            var itemSize = itemBasicProperties.size;

                            if (itemSize < 1024) {
                                itemSize += " bytes";
                            } else if (itemSize < 1048576) {
                                itemSize = Math.round(100 * itemSize / 1024) / 100 + " KB";
                            } else if (itemSize < 1073741824) {
                                itemSize = Math.round(100 * itemSize / 1048576) / 100 + " MB";
                            } else {
                                itemSize = Math.round(100 * itemSize / 1073741824) / 100 + " GB";
                            }

                            var sizeElement = elementTemplate.querySelector(".item-size" + viewDetailsValue);
                            sizeElement.innerText = itemSize;

                            itemElement2Control.innerHTML += "<br />Size: " + itemSize;
                        }

                        var itemDateModified = itemBasicProperties.dateModified.toLocaleString();

                        var dateModifiedElement = elementTemplate.querySelector(".item-datemodified" + viewDetailsValue);
                        dateModifiedElement.innerText = itemDateModified;

                        itemElement2Control.innerHTML += "<br />Date modified: " + itemDateModified;
                    })
                };
            };
        },

        _itemInvoked: function (args) {
            args.detail.itemPromise.done(function (itemInvoked) {
                var selectedItem = itemInvoked.data;
                if (selectedItem.isOfType(Windows.Storage.StorageItemTypes.folder)) {
                    nav.navigate("/pages/itemDetail/itemDetail.html", { item: selectedItem });
                } else {
                    // Launch the selected file using the default application.
                    Windows.System.Launcher.launchFileAsync(selectedItem).done(
                    function (success) {
                        if (success) {
                            // File launched
                        } else {
                            // File launch failed
                            var message = "File launch failed";
                            errorToast("Open", message);
                        }
                    });
                }
            });
        }
    });

    function dataRequested(eventArgs) {
        var request = eventArgs.request;

        var listView = document.querySelector(".itemdetaillist").winControl;
        var listViewSelection = listView.selection;
        var count = listViewSelection.count();
        if (count === 0) {
            request.failWithDisplayText("Select the files you would like to share and try again");
        } else {
            request.data.properties.title = "My Explorer";
            request.data.properties.description = "Selected files in My Explorer";

            listViewSelection.getItems().done(function (selectedItems) {
                var selectedItemsData = [];
                for (var indexSelected = 0; indexSelected < selectedItems.length; indexSelected++) {
                    if (selectedItems[indexSelected].data.isOfType(Windows.Storage.StorageItemTypes.folder)) {
                        break;
                    }
                    selectedItemsData[indexSelected] = selectedItems[indexSelected].data;
                }

                if (selectedItems.length === selectedItemsData.length) {
                    request.data.setStorageItems(selectedItemsData);
                } else {
                    request.failWithDisplayText("Folders are not supported for sharing. Select only files you would like to share and try again");
                }
            });
        }
    }

    function onWindowActivated(args) {
        // Register event to capture clipboard content changes and display the right Favorite/Unfavorite button
        Windows.ApplicationModel.DataTransfer.Clipboard.addEventListener("contentchanged", showHidePasteButton, false);
        showHidePasteButton();

        // An item could've been unpinned while in background. Display the right pinned/unpinned button
        showPinUnpinButton();
    }

    function onWindowDeactivated(args) {
        Windows.ApplicationModel.DataTransfer.Clipboard.removeEventListener("contentchanged", showHidePasteButton, false);
    }

    /* Header menu functions */
    function initHeaderMenu() {
        // Define the header menu
        document.querySelector(".titlearea").addEventListener("click", showHeaderMenu, false);
        document.getElementById("goToMenuItem").addEventListener("click", function () { goTo(); }, false);
        document.getElementById("favoritesMenuItem").addEventListener("click", function () { goToSection("favorites"); }, false);
        document.getElementById("recentMenuItem").addEventListener("click", function () { goToSection("recent"); }, false);
        document.getElementById("homeMenuItem").addEventListener("click", function () { goToSection("home"); }, false);
    }

    /* AppBar functions */
    function initAppBar() {
        if (item.path) {
            var customTopAppBarDiv = document.getElementById("customTopAppBar");
            customTopAppBar.innerText = item.path;
        }

        var appBarDiv = document.getElementById("appBar");
        var appBar = appBarDiv.winControl;

        // Add event listeners
        document.getElementById("cmdSelectAll").addEventListener("click", doClickSelectAll, false);
        document.getElementById("viewFileNameExtensionsMenuItem").addEventListener("click", doClickViewFileNameExtensionsMenuItem, false);
        document.getElementById("viewDetailsMenuItem").addEventListener("click", doClickViewDetails, false);
        document.getElementById("viewThumbnailsMenuItem").addEventListener("click", doClickViewThumbnails, false);
        document.getElementById("sortAscendingMenuItem").addEventListener("click", doClickSortAscending, false);
        document.getElementById("sortDescendingMenuItem").addEventListener("click", doClickSortDescending, false);
        document.getElementById("sortByNameMenuItem").addEventListener("click", doClickSortByName, false);
        document.getElementById("sortByDateModifiedMenuItem").addEventListener("click", doClickSortByDateModified, false);
        document.getElementById("sortByTypeMenuItem").addEventListener("click", doClickSortByType, false);
        document.getElementById("sortBySizeMenuItem").addEventListener("click", doClickSortBySize, false);
        document.getElementById("cmdNewFolder").addEventListener("click", doClickNewFolder, false);
        document.getElementById("newFolderButton").addEventListener("click", doClickNewFolderButton, false);
        document.getElementById("cmdPaste").addEventListener("click", doClickPaste, false);
        document.getElementById("cmdFavorite").addEventListener("click", doClickFavorite, false);
        document.getElementById("cmdUnfavorite").addEventListener("click", doClickUnfavorite, false);
        document.getElementById("cmdPin").addEventListener("click", doClickPin, false);
        document.getElementById("cmdUnpin").addEventListener("click", doClickUnpin, false);
        
        document.getElementById("cmdClearSelection").addEventListener("click", doClickClearSelection, false);
        document.getElementById("cutMenuItem").addEventListener("click", doClickCut, false);
        document.getElementById("copyMenuItem").addEventListener("click", doClickCopy, false);
        document.getElementById("moveToMenuItem").addEventListener("click", doClickMoveTo, false);
        document.getElementById("copyToMenuItem").addEventListener("click", doClickCopyTo, false);
        document.getElementById("recycleMenuItem").addEventListener("click", doClickRecycle, false);
        document.getElementById("deleteMenuItem").addEventListener("click", doClickDelete, false);
        document.getElementById("deleteButton").addEventListener("click", doClickDeleteButton, false);
        document.getElementById("renameMenuItem").addEventListener("click", doClickRename, false);
        document.getElementById("renameButton").addEventListener("click", doClickRenameButton, false);
        document.getElementById("cmdOpenWith").addEventListener("click", doClickOpenWith, false);

        //appBar.addEventListener("beforeshow", doAppBarShow, false);
        //appBar.addEventListener("beforehide", doAppBarHide, false);

        // Hide selection group of commands
        appBar.hideCommands(appBarDiv.querySelectorAll('.singleSelect'));
        appBar.hideCommands(appBarDiv.querySelectorAll('.multiSelect'));

        // Display the right value for view menu items
        if (localSettings.values["viewThumbnails"]) {
            document.getElementById("viewThumbnailsMenuItem").winControl.selected = true;
            document.getElementById("viewDetailsMenuItem").winControl.selected = false;
        } else {
            document.getElementById("viewDetailsMenuItem").winControl.selected = true;
            document.getElementById("viewThumbnailsMenuItem").winControl.selected = false;
        }

        if (localSettings.values["showFileNameExtensions"]) {
            document.getElementById("viewFileNameExtensionsMenuItem").winControl.selected = true;
        }

        // Display the right Favorite/Unfavorite button
        if (Data.isItemInGroup(item, Data.resolveGroupReference("favorites"))) {
            appBar.hideCommands(document.getElementById("cmdFavorite"));
            appBar.showCommands(document.getElementById("cmdUnfavorite"));
        } else {
            appBar.hideCommands(document.getElementById("cmdUnfavorite"));
            appBar.showCommands(document.getElementById("cmdFavorite"));
        }

        // Display the right Pin/Unpin button
        showPinUnpinButton();

        // Display Paste button, if there's an item in the clipboard
        Windows.ApplicationModel.DataTransfer.Clipboard.addEventListener("contentchanged", showHidePasteButton, false);
        showHidePasteButton();
    }

    function showHidePasteButton(args) {
        try {
            var appBar = document.getElementById("appBar").winControl;
            var dataPackageView = null;
            try {
                dataPackageView = Windows.ApplicationModel.DataTransfer.Clipboard.getContent();
            } catch (error) {
                // Ignore error, just hide the paste button
            }

            if (dataPackageView !== null && dataPackageView.contains(Windows.ApplicationModel.DataTransfer.StandardDataFormats.storageItems)) {
                appBar.showCommands(document.getElementById("cmdPaste"));
            } else {
                appBar.hideCommands(document.getElementById("cmdPaste"));
            }
        } catch (error) {
            // The application might be in the background when the page first loads. Ignore the error
        }
    }

    function showPinUnpinButton() {
        var appBar = document.getElementById("appBar").winControl;
        var pinnedItemId = Data.generatePinId(item);
        if (Windows.UI.StartScreen.SecondaryTile.exists(pinnedItemId)) {
            appBar.hideCommands(document.getElementById("cmdPin"));
            appBar.showCommands(document.getElementById("cmdUnpin"));
        } else {
            appBar.hideCommands(document.getElementById("cmdUnpin"));
            appBar.showCommands(document.getElementById("cmdPin"));
        }
    }

    function doClickSelectAll() {
        var listView = document.querySelector(".itemdetaillist").winControl;
        listView.selection.selectAll();

        //doAppBarShow();
    }

    function doClickViewFileNameExtensionsMenuItem() {
        var currentMenuItem = this.winControl;
        var viewDetailsValue = (localSettings.values["viewThumbnails"]) ? "" : "-details";
        var showFileNameExtensionsValue = currentMenuItem.selected;
        var fileNameExtensions = document.querySelectorAll(".item-extension" + viewDetailsValue);
        for (var currentFileIndex = 0; currentFileIndex < fileNameExtensions.length; currentFileIndex++) {
            var currentFileExtension = fileNameExtensions[currentFileIndex];
            currentFileExtension.style.display = showFileNameExtensionsStyle[showFileNameExtensionsValue].display;
            currentFileExtension.style.visibility = showFileNameExtensionsStyle[showFileNameExtensionsValue].visibility;
        }

        localSettings.values["showFileNameExtensions"] = currentMenuItem.selected;
    }

    function doClickViewDetails() {
        var currentMenuItem = this.winControl;
        if (currentMenuItem.selected) {
            document.getElementById("viewThumbnailsMenuItem").winControl.selected = false;

            var itemElements = document.querySelectorAll(".item");
            var itemImageElements = document.querySelectorAll(".item-image");
            var itemOverlayElements = document.querySelectorAll(".item-overlay");
            var itemTitleElements = document.querySelectorAll(".item-title");
            var itemNameElements = document.querySelectorAll(".item-name");
            var itemExtensionElements = document.querySelectorAll(".item-extension");
            var itemTypeElements = document.querySelectorAll(".item-type");
            var itemSizeElements = document.querySelectorAll(".item-size");
            var itemDateModifiedElements = document.querySelectorAll(".item-datemodified");

            for (var currentFileIndex = 0; currentFileIndex < itemElements.length; currentFileIndex++) {
                var currentItemElement = itemElements[currentFileIndex];
                var currentItemImageElement = itemImageElements[currentFileIndex];
                var currentItemOverlayElement = itemOverlayElements[currentFileIndex];
                var currentItemTitleElement = itemTitleElements[currentFileIndex];
                var currentItemNameElement = itemNameElements[currentFileIndex];
                var currentItemExtensionElement = itemExtensionElements[currentFileIndex];
                var currentItemTypeElement = itemTypeElements[currentFileIndex];
                var currentItemSizeElement = itemSizeElements[currentFileIndex];
                var currentItemDateModifiedElement = itemDateModifiedElements[currentFileIndex];

                utils.removeClass(currentItemDateModifiedElement, "item-datemodified"); 
                utils.removeClass(currentItemSizeElement, "item-size");
                utils.removeClass(currentItemTypeElement, "item-type");
                utils.removeClass(currentItemExtensionElement, "item-extension");
                utils.removeClass(currentItemNameElement, "item-name");
                utils.removeClass(currentItemTitleElement, "item-title");
                utils.removeClass(currentItemOverlayElement, "item-overlay");
                utils.removeClass(currentItemImageElement, "item-image");
                utils.removeClass(currentItemElement, "item");

                utils.addClass(currentItemElement, "item-details");
                utils.addClass(currentItemImageElement, "item-image-details");
                utils.addClass(currentItemOverlayElement, "item-overlay-details");
                utils.addClass(currentItemTitleElement, "item-title-details");
                utils.addClass(currentItemNameElement, "item-name-details");
                utils.addClass(currentItemExtensionElement, "item-extension-details");
                utils.addClass(currentItemTypeElement, "item-type-details");
                utils.addClass(currentItemSizeElement, "item-size-details");
                utils.addClass(currentItemDateModifiedElement, "item-datemodified-details");

                var listViewElement = document.querySelector(".itemdetaillist");
                var listViewControl = listViewElement.winControl;
                listViewElement.style.display.visibility = "none";
                listViewElement.style.display.visibility = "display";
                listViewControl.forceLayout();
            }
        } else {
            currentMenuItem.selected = true;
        }

        localSettings.values["viewThumbnails"] = false;
    }

    function doClickViewThumbnails() {
        var currentMenuItem = this.winControl;
        if (currentMenuItem.selected) {
            document.getElementById("viewDetailsMenuItem").winControl.selected = false;

            var itemElements = document.querySelectorAll(".item-details");
            var itemImageElements = document.querySelectorAll(".item-image-details");
            var itemOverlayElements = document.querySelectorAll(".item-overlay-details");
            var itemTitleElements = document.querySelectorAll(".item-title-details");
            var itemNameElements = document.querySelectorAll(".item-name-details");
            var itemExtensionElements = document.querySelectorAll(".item-extension-details");
            var itemTypeElements = document.querySelectorAll(".item-type-details");
            var itemSizeElements = document.querySelectorAll(".item-size-details");
            var itemDateModifiedElements = document.querySelectorAll(".item-datemodified-details");

            for (var currentFileIndex = 0; currentFileIndex < itemElements.length; currentFileIndex++) {
                var currentItemElement = itemElements[currentFileIndex];
                var currentItemImageElement = itemImageElements[currentFileIndex];
                var currentItemOverlayElement = itemOverlayElements[currentFileIndex];
                var currentItemTitleElement = itemTitleElements[currentFileIndex];
                var currentItemNameElement = itemNameElements[currentFileIndex];
                var currentItemExtensionElement = itemExtensionElements[currentFileIndex];
                var currentItemTypeElement = itemTypeElements[currentFileIndex];
                var currentItemSizeElement = itemSizeElements[currentFileIndex];
                var currentItemDateModifiedElement = itemDateModifiedElements[currentFileIndex];

                utils.removeClass(currentItemDateModifiedElement, "item-datemodified-details");
                utils.removeClass(currentItemSizeElement, "item-size-details");
                utils.removeClass(currentItemTypeElement, "item-type-details");
                utils.removeClass(currentItemExtensionElement, "item-extension-details");
                utils.removeClass(currentItemNameElement, "item-name-details");
                utils.removeClass(currentItemTitleElement, "item-title-details");
                utils.removeClass(currentItemOverlayElement, "item-overlay-details");
                utils.removeClass(currentItemImageElement, "item-image-details");
                utils.removeClass(currentItemElement, "item-details");

                utils.addClass(currentItemElement, "item");
                utils.addClass(currentItemImageElement, "item-image");
                utils.addClass(currentItemOverlayElement, "item-overlay");
                utils.addClass(currentItemTitleElement, "item-title");
                utils.removeClass(currentItemNameElement, "item-name");
                utils.addClass(currentItemExtensionElement, "item-extension");
                utils.addClass(currentItemTypeElement, "item-type");
                utils.addClass(currentItemSizeElement, "item-size");
                utils.addClass(currentItemDateModifiedElement, "item-datemodified");

                var listViewElement = document.querySelector(".itemdetaillist");
                var listViewControl = listViewElement.winControl;
                listViewElement.style.display.visibility = "none";
                listViewElement.style.display.visibility = "display";
                listViewControl.forceLayout();
            }
        } else {
            currentMenuItem.selected = true;
        }

        localSettings.values["viewThumbnails"] = true;
    }

    function doClickSortAscending() {
        var currentMenuItem = this.winControl;
        if (currentMenuItem.selected) {
            document.getElementById("sortDescendingMenuItem").winControl.selected = false;
        } else {
            currentMenuItem.selected = true;
        }
    }

    function doClickSortDescending() {
        var currentMenuItem = this.winControl;
        if (currentMenuItem.selected) {
            document.getElementById("sortAscendingMenuItem").winControl.selected = false;
        } else {
            currentMenuItem.selected = true;
        }
    }

    function doClickSortByName() {
        var currentMenuItem = this.winControl;
        if (currentMenuItem.selected) {
            document.getElementById("sortByDateModifiedMenuItem").winControl.selected = false;
            document.getElementById("sortByTypeMenuItem").winControl.selected = false;
            document.getElementById("sortBySizeMenuItem").winControl.selected = false;
        } else {
            currentMenuItem.selected = true;
        }
    }

    function doClickSortByDateModified() {
        var currentMenuItem = this.winControl;
        if (currentMenuItem.selected) {
            document.getElementById("sortByNameMenuItem").winControl.selected = false;
            document.getElementById("sortByTypeMenuItem").winControl.selected = false;
            document.getElementById("sortBySizeMenuItem").winControl.selected = false;
        } else {
            currentMenuItem.selected = true;
        }
    }

    function doClickSortByType() {
        var currentMenuItem = this.winControl;
        if (currentMenuItem.selected) {
            document.getElementById("sortByNameMenuItem").winControl.selected = false;
            document.getElementById("sortByDateModifiedMenuItem").winControl.selected = false;
            document.getElementById("sortBySizeMenuItem").winControl.selected = false;
        } else {
            currentMenuItem.selected = true;
        }
    }

    function doClickSortBySize() {
        var currentMenuItem = this.winControl;
        if (currentMenuItem.selected) {
            document.getElementById("sortByNameMenuItem").winControl.selected = false;
            document.getElementById("sortByDateModifiedMenuItem").winControl.selected = false;
            document.getElementById("sortByTypeMenuItem").winControl.selected = false;
        } else {
            currentMenuItem.selected = true;
        }
    }

    function doClickNewFolder() {
        document.getElementById("newFolderName").value = "New folder";
    }

    function doClickNewFolderButton() {
        item.createFolderAsync(document.getElementById("newFolderName").value).done(function () {
            // Success
            document.getElementById("newFolderFlyout").winControl.hide();
        }, function (error) {
            var message = null;
            switch (error.number) {
                case -2147024809:
                    message = "Cannot create a folder without name";
                    break;
                case -2147024773:
                    message = "Name cannot include special characters, or begin/end with a '.'";
                    break;
                case -2147024713:
                    message = "Cannot create a folder when the name already exists";
                    break;
                default:
                    message = error.message;
            }
            errorToast("New folder", message);
            document.getElementById("newFolderName").focus();
        });
    }

    function doClickPaste() {
        // Reset move options to be ready for moving
        Data.resetMoveOptions();

        // get the content from clipboard
        var dataPackageView = Windows.ApplicationModel.DataTransfer.Clipboard.getContent();

        if (dataPackageView.contains(Windows.ApplicationModel.DataTransfer.StandardDataFormats.storageItems)) {
            dataPackageView.getStorageItemsAsync().done(function (clipboardItems) {
                if (dataPackageView.requestedOperation === Windows.ApplicationModel.DataTransfer.DataPackageOperation.copy || (dataPackageView.requestedOperation === Windows.ApplicationModel.DataTransfer.DataPackageOperation.move && Data.getCutItems().length == 0)) {
                    if (dataPackageView.requestedOperation === Windows.ApplicationModel.DataTransfer.DataPackageOperation.move && Data.getCutItems().length == 0) {
                        var message = "Cannot cut the source item(s)" + ((clipboardItems.length > 1) ? "s" : "") + ". Pasting as copy";
                        errorToast("Paste", message);
                    }

                    clipboardItems.forEach(function (clipboardItem) {
                        if (clipboardItem.isOfType(Windows.Storage.StorageItemTypes.file)) {
                            clipboardItem.copyAsync(item, clipboardItem.name, Windows.Storage.NameCollisionOption[localSettings.values["collisionOption"]]).done(function (newItem) {
                                // Success
                            }, function (error) {
                                var message = "Error pasting item (" + error.message + ")";
                                errorToast("Paste", message);
                            });
                        } else {
                            Data.moveOrCopyFolder(clipboardItem, item, "Copy");
                        }
                    });
                } else {
                    var notifyFolderCutIsDisabled = false;
                    Data.getCutItems().forEach(function (cutItem) {
                        if (cutItem.isOfType(Windows.Storage.StorageItemTypes.file)) {
                            cutItem.moveAsync(item, cutItem.name, Windows.Storage.NameCollisionOption[localSettings.values["collisionOption"]]).done(function (newItem) {
                                // Success
                            }, function (error) {
                                var message = "Error pasting item (" + error.message + ")";
                                informationToast("Paste", message);
                            });
                        } else {
                            // Cutting folders isn't supported, so pasting as copy
                            if (!notifyFolderCutIsDisabled) {
                                var message = "Cutting folders isn't supported (yet). Pasting folder(s) as copy";
                                toast("Paste", message);

                                notifyFolderCutIsDisabled = true;
                            }

                            Data.moveOrCopyFolder(cutItem, item, "Copy");
                            //Data.moveFolder(cutItem, item, "Cut");
                        }
                    });
                }
            }, function (error) {
                var message = "Error retrieving item(s) from clipboard (" + error.message + ")";
                errorToast("Paste", message);
            });
        } else {
            var message = "The clipboard doesn't contain files or folders";
            errorToast("Paste", message);
        }
    }

    function doClickFavorite() {
        if (Data.addToGroup(Data.resolveGroupReference("favorites"), item, true)) {
            var appBar = document.getElementById("appBar").winControl;
            appBar.hideCommands(document.getElementById("cmdFavorite"));
            appBar.showCommands(document.getElementById("cmdUnfavorite"));
        } else {
            var message = "There are already 999 favorites + pinned folders. Remove one before adding another";
            errorToast("Add favorite", message);
        }
    }

    function doClickUnfavorite() {
        Data.removeFromList(Data.getItemFromGroup(item, Data.resolveGroupReference("favorites")));


        var appBar = document.getElementById("appBar").winControl;
        appBar.hideCommands(document.getElementById("cmdUnfavorite"));
        appBar.showCommands(document.getElementById("cmdFavorite"));
    }

    function doClickPin() {
        if (!Data.isPersistenceGroupFull("favorites")) {
            var appBar = document.getElementById("appBar").winControl;
            var previousAppBarState = appBar.sticky;
            if (!previousAppBarState) {
                appBar.sticky = true;
            }

            var uriLogo = new Windows.Foundation.Uri("ms-appx:///images/folderlogo.png");
            var uriSmallLogo = new Windows.Foundation.Uri("ms-appx:///images/foldersmallLogo.png");
            var tile = new Windows.UI.StartScreen.SecondaryTile(Data.generatePinId(item), item.displayName, item.displayName, Data.generateToken(item), Windows.UI.StartScreen.TileOptions.showNameOnLogo, uriLogo);
            tile.foregroundText = Windows.UI.StartScreen.ForegroundText.light;
            tile.backgroundColor = Windows.UI.ColorHelper.fromArgb(1, 48, 48, 48);
            tile.smallLogo = uriSmallLogo;

            var selectionRect = document.getElementById("cmdPin").getBoundingClientRect();
            tile.requestCreateForSelectionAsync({ x: selectionRect.left, y: selectionRect.top, width: selectionRect.width, height: selectionRect.height }, Windows.UI.Popups.Placement.above).done(function (isCreated) {
                if (isCreated) {
                    Data.addPinnedFolder(item);
                    showPinUnpinButton();
                }

                if (!previousAppBarState) {
                    appBar.sticky = false;
                    appBar.hide();
                }
            });
        } else {
            var message = "There are already 999 favorites + pinned folders. Remove one before adding another";
            errorToast("Pin to Start", message);
        }
    }

    function doClickUnpin() {
        var appBar = document.getElementById("appBar").winControl;
        var previousAppBarState = appBar.sticky;
        if (!previousAppBarState) {
            appBar.sticky = true;
        }

        var selectionRect = document.getElementById("cmdUnpin").getBoundingClientRect();
        var tileToGetDeleted = new Windows.UI.StartScreen.SecondaryTile(Data.generatePinId(item));
        tileToGetDeleted.requestDeleteForSelectionAsync({ x: selectionRect.left, y: selectionRect.top, width: selectionRect.width, height: selectionRect.height }, Windows.UI.Popups.Placement.above).done(function (isDeleted) {
            if (isDeleted) {
                Data.removePinnedFolder(item);
                showPinUnpinButton();
            }

            if (!previousAppBarState) {
                appBar.sticky = false;
                appBar.hide();
            }
        });
    }

    function doClickClearSelection() {
        var listView = document.querySelector(".itemdetaillist").winControl;
        listView.selection.clear();
    }

    function doClickCut() {
        var listView = document.querySelector(".itemdetaillist").winControl;
        var listViewSelection = listView.selection;
        listViewSelection.getItems().done(function (selectedItems) {
            var selectedItemsData = [];
            for (var indexSelected = 0; indexSelected < selectedItems.length; indexSelected++) {
                selectedItemsData[indexSelected] = selectedItems[indexSelected].data;
            }

            // Keep a reference to the cut files to delete after successful paste
            Data.setCutItems(selectedItemsData);

            var dataPackage = new Windows.ApplicationModel.DataTransfer.DataPackage();

            dataPackage.setStorageItems(selectedItemsData);

            // Request a copy operation from targets that support different file operations, like File Explorer
            dataPackage.requestedOperation = Windows.ApplicationModel.DataTransfer.DataPackageOperation.move;

            try {
                // copy the content to Clipboard
                Windows.ApplicationModel.DataTransfer.Clipboard.setContent(dataPackage);
            } catch (error) {
                // Copying data to Clipboard can potentially fail - for example, if another application is holding Clipboard open
                var message = "Copying data to the clipboard failed";
                errorToast("Copy", message + "(" + error.message + ")");
            }
        });
    }

    function doClickCopy() {
        var listView = document.querySelector(".itemdetaillist").winControl;
        var listViewSelection = listView.selection;
        listViewSelection.getItems().done(function (selectedItems) {
            var selectedItemsData = [];
            for (var indexSelected = 0; indexSelected < selectedItems.length; indexSelected++) {
                selectedItemsData[indexSelected] = selectedItems[indexSelected].data;
            }

            var dataPackage = new Windows.ApplicationModel.DataTransfer.DataPackage();

            dataPackage.setStorageItems(selectedItemsData);

            // Request a copy operation from targets that support different file operations, like File Explorer
            dataPackage.requestedOperation = Windows.ApplicationModel.DataTransfer.DataPackageOperation.copy;

            try {
                // copy the content to Clipboard
                Windows.ApplicationModel.DataTransfer.Clipboard.setContent(dataPackage);
            } catch (error) {
                // Copying data to Clipboard can potentially fail - for example, if another application is holding Clipboard open
                var message = "Copying data to the clipboard failed";
                errorToast("Copy", message + "(" + error.message + ")");
            }
        });
    }

    function doClickMoveTo() {
        // Reset move options to be ready for moving
        Data.resetMoveOptions();

        // Get the destination folder
        var folderPicker = new Windows.Storage.Pickers.FolderPicker;
        folderPicker.suggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.computerFolder;
        folderPicker.fileTypeFilter.replaceAll(["*"]);
        folderPicker.pickSingleFolderAsync().done(function (folder) {
            if (folder) {
                var listView = document.querySelector(".itemdetaillist").winControl;
                var listViewSelection = listView.selection;
                listViewSelection.getItems().then(function (selectedItems) {
                    for (var indexSelected = 0; indexSelected < selectedItems.length; indexSelected++) {
                        var currentItem = selectedItems[indexSelected].data;
                        if (currentItem.isOfType(Windows.Storage.StorageItemTypes.file)) {
                            currentItem.moveAsync(folder, currentItem.name, Windows.Storage.NameCollisionOption[localSettings.values["collisionOption"]]).done(function () {
                                // Success
                            }, function (error) {
                                var message = null;
                                switch (error.number) {
                                    case -2147024713:
                                        message = "Cannot move to a folder where the file name already exists";
                                        break;
                                    default:
                                        message = error.message;
                                }
                                errorToast("Move to", message);
                            });
                        } else {
                            Data.moveFolder(currentItem, folder, "Move to");
                        }
                    }
                });
            } else {
                // No folder was selected. Do nothing
            }
        });
    }

    function doClickCopyTo() {
        // Get the destination folder
        var folderPicker = new Windows.Storage.Pickers.FolderPicker;
        folderPicker.suggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.computerFolder;
        folderPicker.fileTypeFilter.replaceAll(["*"]);
        folderPicker.pickSingleFolderAsync().done(function (folder) {
            if (folder) {
                var listView = document.querySelector(".itemdetaillist").winControl;
                var listViewSelection = listView.selection;
                listViewSelection.getItems().then(function (selectedItems) {
                    for (var indexSelected = 0; indexSelected < selectedItems.length; indexSelected++) {
                        var currentItem = selectedItems[indexSelected].data;
                        if (currentItem.isOfType(Windows.Storage.StorageItemTypes.file)) {
                            currentItem.copyAsync(folder, currentItem.name, Windows.Storage.NameCollisionOption[localSettings.values["collisionOption"]]).done(function () {
                                // Success
                            }, function (error) {
                                var message = null;
                                switch (error.number) {
                                    case -2147024713:
                                        message = "Cannot copy to a folder where the file name already exists";
                                        break;
                                    default:
                                        message = error.message;
                                }
                                errorToast("Copy to", message);
                            });
                        } else {
                            Data.moveOrCopyFolder(currentItem, folder, "Copy to");
                        }
                    }
                });
            } else {
                // No folder was selected. Do nothing
            }
        });
    }

    function doClickRecycle() {
        var listView = document.querySelector(".itemdetaillist").winControl;
        var listViewSelection = listView.selection;
        listViewSelection.getItems().done(function (selectedItems) {
            for (var indexSelected = 0; indexSelected < selectedItems.length; indexSelected++) {
                var currentItem = selectedItems[indexSelected].data;
                currentItem.deleteAsync().done(function () {
                    // Success
                }, function (error) {
                    var message = null;
                    switch (error.number) {
                        default:
                            message = error.message;
                    }
                    errorToast("Recycle", message);
                });
            }
        });
    }

    function doClickDelete() {
        var listView = document.querySelector(".itemdetaillist").winControl;
        var listViewSelection = listView.selection;
        var count = listViewSelection.count();
        if (count > 1) {
            document.getElementById("deleteSubmenuText").textContent = count + " items";
        } else {
            listViewSelection.getItems().done(function (selectedItems) {
                var selectedItem = selectedItems[0].data;
                var selectedItemName = localSettings.values["showFileNameExtensions"] ? selectedItem.name : selectedItem.displayName;
                document.getElementById("deleteSubmenuText").textContent = "\"" + selectedItemName + "\"";
            });
        }
    }

    function doClickDeleteButton() {
        var listView = document.querySelector(".itemdetaillist").winControl;
        var listViewSelection = listView.selection;
        listViewSelection.getItems().done(function (selectedItems) {
            for (var indexSelected = 0; indexSelected < selectedItems.length; indexSelected++) {
                var currentItem = selectedItems[indexSelected].data;
                currentItem.deleteAsync(Windows.Storage.StorageDeleteOption.permanentDelete).done(function () {
                    // Success
                    document.getElementById("deleteFlyout").winControl.hide();
                }, function (error) {
                    var message = null;
                    switch (error.number) {
                        default:
                            message = error.message;
                    }
                    errorToast("Recycle", message);
                });
            }
        });
    }

    function doClickRename() {
        var listView = document.querySelector(".itemdetaillist").winControl;
        var listViewSelection = listView.selection;
        listViewSelection.getItems().done(function (selectedItems) {
            var selectedItem = selectedItems[0].data;
            var selectedItemName = localSettings.values["showFileNameExtensions"] ? selectedItem.name : selectedItem.displayName;
            document.getElementById("renameName").value = selectedItemName;
        });
    }

    function doClickRenameButton() {
        var listView = document.querySelector(".itemdetaillist").winControl;
        var listViewSelection = listView.selection;
        listViewSelection.getItems().then(function (selectedItems) {
            var renameName = document.getElementById("renameName").value;
            var nameCollisionOption = (selectedItems.length > 1) ? Windows.Storage.NameCollisionOption.generateUniqueName : Windows.Storage.NameCollisionOption[localSettings.values["collisionOption"]];
            for (var indexSelected = 0; indexSelected < selectedItems.length; indexSelected++) {
                var currentItem = selectedItems[indexSelected].data;
                var fileExtension = (!localSettings.values["showFileNameExtensions"] && currentItem.isOfType(Windows.Storage.StorageItemTypes.file)) ? currentItem.fileType : "";
                try {
                    currentItem.renameAsync(renameName + fileExtension, nameCollisionOption).done(function () {
                        // Success
                        document.getElementById("renameFlyout").winControl.hide();
                    }, function (error) {
                        var message = null;
                        switch (error.number) {
                            case -2147024713:
                                message = "Cannot rename the item(s) to a name that already exists";
                                break;
                            default:
                                message = error.message;
                        }
                        errorToast("Rename", message);
                        document.getElementById("renameName").focus();
                    });
                } catch (error) {
                    var message = null;
                    switch (error.number) {
                        case -2147024809:
                            message = "A new name needs to be specified";
                            break;
                        case -2147024773:
                            message = "Name cannot include special characters, or begin/end with a \".\"";
                            break;
                        default:
                            message = error.message;
                    }
                    errorToast("Rename", message);
                    document.getElementById("renameName").focus();
                }
            }
        });
    }

    function doClickOpenWith() {
        // Get the selected file
        var listView = document.querySelector(".itemdetaillist").winControl;
        var listViewSelection = listView.selection;
        listViewSelection.getItems().done(function (selectedItems) {
            var selectedFile = selectedItems[0].data;

            // Set the show picker option.
            var launcherOptions = new Windows.System.LauncherOptions();
            launcherOptions.displayApplicationPicker = true;

            // Position the Open with dialog so that it aligns with the button.
            // An alternative to using the rect is to set a point indicating where the dialog is supposed to be shown.
            launcherOptions.ui.selectionRect = getSelectionRect(document.getElementById("cmdOpenWith"));
            launcherOptions.ui.preferredPlacement = Windows.UI.Popups.Placement.above;

            // Now launch the retrieved file.
            Windows.System.Launcher.launchFileAsync(selectedFile, launcherOptions).done(function (success) {
                if (success) {
                    // File launched
                } else {
                    // File launch failed
                    var message = "File launch failed";
                    errorToast("Open with", message);
                }
            });
        });
    }

    /* This function slides the ListView scrollbar into view if occluded by the AppBar (in sticky mode) */
    function doAppBarShow() {
        var appBar = document.getElementById("appBar");

        // Move the scrollbar into view if appbar is sticky
        if (appBar.winControl.sticky) {
            var listView = document.querySelector(".itemdetaillist");
            var listViewTargetHeight = "calc(100% - " + appBar.offsetHeight + "px)";
            var transition = {
                property: 'height',
                duration: 367,
                timing: "cubic-bezier(0.1, 0.9, 0.2, 0.1)",
                to: listViewTargetHeight
            };
            WinJS.UI.executeTransition(listView, transition);

            var listViewSurface = listView.querySelector(".win-horizontal.win-viewport .win-surface");
            var listViewTargetMarginBottom = "0px";
            var transition2 = {
                property: 'margin-bottom',
                duration: 367,
                timing: "cubic-bezier(0.1, 0.9, 0.2, 0.1)",
                to: listViewTargetMarginBottom
            };
            WinJS.UI.executeTransition(listViewSurface, transition2);
        }
    }

    /* This function slides the ListView scrollbar back to its original position */
    function doAppBarHide() {
        var appBar = document.getElementById("appBar");

        // Move the scrollbar into view if appbar is sticky
        if (appBar.winControl.sticky) {
            var listView = document.querySelector(".itemdetaillist");
            var listViewTargetHeight = "100%";
            var transition = {
                property: 'height',
                duration: 367,
                timing: "cubic-bezier(0.1, 0.9, 0.2, 0.1)",
                to: listViewTargetHeight
            };
            WinJS.UI.executeTransition(listView, transition);

            var listViewSurface = listView.querySelector(".win-horizontal.win-viewport .win-surface");
            var listViewTargetMarginBottom = "60px";
            var transition2 = {
                property: 'margin-bottom',
                duration: 367,
                timing: "cubic-bezier(0.1, 0.9, 0.2, 0.1)",
                to: listViewTargetMarginBottom
            };
            WinJS.UI.executeTransition(listViewSurface, transition2);
        }
    }

    /* This function shows the appBar when there's an item selected */
    function doSelectItem() {
        var customTopAppBarDiv = document.getElementById("customTopAppBar");
        var customTopAppBar = customTopAppBarDiv.winControl;
        var appBarDiv = document.getElementById("appBar");
        var appBar = appBarDiv.winControl;
        var listView = document.querySelector(".itemdetaillist").winControl;
        var listViewSelection = listView.selection;
        var count = listViewSelection.count();
        switch (count) {
            case 0:
                // Hide selection commands in AppBar and swap "Clear selection" for "Select all"
                customTopAppBar.hide();
                appBar.hide();
                appBar.hideCommands(appBarDiv.querySelectorAll('.singleSelect'));
                appBar.hideCommands(appBarDiv.querySelectorAll('.multiSelect'));
                appBar.hideCommands(document.getElementById('cmdClearSelection'));
                customTopAppBar.sticky = false;
                appBar.sticky = false;
                break;
            case 1:
                // Show selection commands in AppBar (single and multi select) and swap "Select all" for "Clear selection"
                appBar.showCommands(appBarDiv.querySelectorAll('.singleSelect'));
                appBar.showCommands(appBarDiv.querySelectorAll('.multiSelect'));
                appBar.showCommands(document.getElementById('cmdClearSelection'));

                // Some commands should show only if the selected item is of a specific type
                listViewSelection.getItems().done(function (selectedItems) {
                    // Some commands invoke the picker, so they cannot be actived on snapped view
                    if (currentViewState === appViewState.snapped) {
                        document.getElementById("moveToMenuItem").disabled = true;
                        document.getElementById("copyToMenuItem").disabled = true;
                    } else {
                        if (selectedItems[0].data.isOfType(Windows.Storage.StorageItemTypes.folder)) {
                            document.getElementById("moveToMenuItem").disabled = true;

                            appBar.hideCommands(document.getElementById('cmdOpenWith'));
                        } else {
                            appBar.showCommands(document.getElementById('cmdOpenWith'));
                        }
                    }
                });

                customTopAppBar.sticky = true;
                appBar.sticky = true;
                customTopAppBar.show();
                appBar.show();
                break;
            default:
                // Show selection commands in AppBar (multi select only) and swap "Select all" for "Clear selection"
                appBar.hideCommands(appBarDiv.querySelectorAll('.singleSelect'));
                appBar.showCommands(appBarDiv.querySelectorAll('.multiSelect'));
                appBar.showCommands(document.getElementById('cmdClearSelection'));

                // Some commands invoke the picker, so they cannot be actived on snapped view
                if (currentViewState === appViewState.snapped) {
                    document.getElementById("moveToMenuItem").disabled = true;
                    document.getElementById("copyToMenuItem").disabled = true;
                } else {
                    document.getElementById("moveToMenuItem").disabled = false;
                    document.getElementById("copyToMenuItem").disabled = false;

                    // Some commands should show or be enabled only if the selected item is of a specific type
                    listViewSelection.getItems().done(function (selectedItems) {
                        for (var currentItemIndex = 0; currentItemIndex < selectedItems.length; currentItemIndex++) {
                            // Some commands invoke the picker, so they cannot be actived on snapped view
                            if (selectedItems[currentItemIndex].data.isOfType(Windows.Storage.StorageItemTypes.folder)) {
                                document.getElementById("moveToMenuItem").disabled = true;
                                break;
                            }
                        }
                    });
                }

                customTopAppBar.sticky = true;
                appBar.sticky = true;
                customTopAppBar.show();
                appBar.show();
                break;
        }
    }
})();
