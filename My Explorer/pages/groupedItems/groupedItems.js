(function () {
    "use strict";

    var appView = Windows.UI.ViewManagement.ApplicationView;
    var appViewState = Windows.UI.ViewManagement.ApplicationViewState;
    var nav = WinJS.Navigation;
    var ui = WinJS.UI;

    var localSettings = Windows.Storage.ApplicationData.current.localSettings;

    ui.Pages.define("/pages/groupedItems/groupedItems.html", {
        // Navigates to the groupHeaderPage. Called from the groupHeaders,
        // keyboard shortcut and iteminvoked.
        navigateToGroup: function (key) {
            nav.navigate("/pages/groupDetail/groupDetail.html", { groupKey: key });
        },

        // This function is called whenever a user navigates to this page. It
        // populates the page elements with the app's data.
        ready: function (element, options) {
            // Define the header menu
            initHeaderMenu();
                
            // Define appBar
            initAppBar();

            var titleElement = element.querySelector("header[role=banner] .pagetitle");
            titleElement.textContent = "My Explorer";

            var listView = element.querySelector(".groupeditemslist").winControl;
            listView.groupHeaderTemplate = element.querySelector(".headertemplate");
            listView.itemTemplate = element.querySelector(".itemtemplate");
            listView.oniteminvoked = this._itemInvoked.bind(this);

            // Set up a keyboard shortcut (ctrl + alt + g) to navigate to the
            // current group when not in snapped mode.
            listView.addEventListener("keydown", function (e) {
                if (appView.value !== appViewState.snapped && e.ctrlKey && e.altKey) {
                    switch (e.keyCode) {
                        case WinJS.Utilities.Key.g:
                            var data = listView.itemDataSource.list.getAt(listView.currentItem.index);
                            this.navigateToGroup(data.group.key);
                            break;
                        case WinJS.Utilities.Key.f:
                            goToSection("favorites");
                            break;
                        case WinJS.Utilities.Key.r:
                            goToSection("recent");
                            break;
                    }
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            }.bind(this), true);

            this._initializeLayout(listView, appView.value);
            listView.element.focus();

            if (localSettings.values["startOn"] !== "custom") {
                // The group folder is not an actual folder. In order to be able to insert metadata in the futureAccessList, the picturesLibrary is used as item. It'll be ignored on load
                Data.getPersistenceGroup("favorites").addOrReplace("startOn", Windows.Storage.KnownFolders.picturesLibrary, "home");
            }

            // Enable share as a source
            var dataTransferManager = Windows.ApplicationModel.DataTransfer.DataTransferManager.getForCurrentView();
            dataTransferManager.addEventListener("datarequested", dataRequested);
        },

        unload: function () {
            // Disable share as a source
            var dataTransferManager = Windows.ApplicationModel.DataTransfer.DataTransferManager.getForCurrentView();
            dataTransferManager.removeEventListener("datarequested", dataRequested);
        },

        // This function updates the page layout in response to viewState changes.
        updateLayout: function (element, viewState, lastViewState) {
            /// <param name="element" domElement="true" />

            var listView = element.querySelector(".groupeditemslist").winControl;
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

            var appBar = document.getElementById("appBar").winControl;

            if (viewState === appViewState.snapped) {
                listView.itemDataSource = Data.getGroups().dataSource;
                listView.groupDataSource = null;
                listView.layout = new ui.ListLayout();

                document.getElementById("goToMenuItem").disabled = true;
            } else {
                listView.itemDataSource = Data.getItems().dataSource;
                listView.groupDataSource = Data.getGroups().dataSource;
                listView.layout = new ui.GridLayout({ groupHeaderPosition: "top" });

                document.getElementById("goToMenuItem").disabled = false;
            }

            // Add appBar event listener and display/hide it and the items
            listView.addEventListener("selectionchanged", doSelectItem);
            doSelectItem();
        },

        _itemInvoked: function (args) {
            if (appView.value === appViewState.snapped) {
                // If the page is snapped, the user invoked a group.
                var group = Data.getGroups().getAt(args.detail.itemIndex);
                this.navigateToGroup(group.key);
            } else {
                // If the page is not snapped, the user invoked an item.
                var item = Data.getItems().getAt(args.detail.itemIndex);

                // To guarantee the folder is still accessible. Try to reload the folder in the app before navigating to it
                var groupKey = item.group.key;
                var itemToken = item.key.substring(item.key.indexOf("|") + 1);
                Data.getPersistedItem(groupKey, itemToken).done(function (folder) {
                    nav.navigate("/pages/itemDetail/itemDetail.html", { item: folder });
                }, function (error) {
                    var message = "The folder could not be accessed. Verify it exists and you have access to it";
                    errorToast("Open folder", message);
                });
            }
        }
    });

    function dataRequested(eventArgs) {
        var request = eventArgs.request;

        var listView = document.querySelector(".groupeditemslist").winControl;
        var listViewSelection = listView.selection;
        var count = listViewSelection.count();
        if (count === 0) {
            request.failWithDisplayText("Select the files you would like to share and try again");
        } else {
            request.failWithDisplayText("Folders are not supported for sharing. Select only files you would like to share and try again");
        }
    }

    function showHideClearRecentButton() {
        var appBarDiv = document.getElementById("appBar");
        var appBar = appBarDiv.winControl;

        var clearRecentButton = document.getElementById("cmdClearRecent");
        if (Data.resolveGroupReference("recent") === undefined) {
            appBar.hideCommands(clearRecentButton);
        } else {
            appBar.showCommands(clearRecentButton);
        }
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
        var appBarDiv = document.getElementById("appBar");
        var appBar = appBarDiv.winControl;

        // Add event listeners
        document.getElementById("cmdSelectAll").addEventListener("click", doClickSelectAll, false);
        document.getElementById("cmdClearRecent").addEventListener("click", doClickClearRecent, false);
        document.getElementById("cmdAddFavorite").addEventListener("click", doClickAddFavorite, false);

        document.getElementById("cmdClearSelection").addEventListener("click", doClickClearSelection, false);
        document.getElementById("cmdRemove").addEventListener("click", doClickRemove, false);

        //appBar.addEventListener("beforeshow", doAppBarShow, false);
        //appBar.addEventListener("beforehide", doAppBarHide, false);

        // Hide selection group of commands
        //appBar.hideCommands(appBarDiv.querySelectorAll('.singleSelect'));
        appBar.hideCommands(appBarDiv.querySelectorAll('.multiSelect'));

        // Show/hide clear recent group button
        showHideClearRecentButton();
    }

    function doClickSelectAll() {
        var listView = document.querySelector(".groupeditemslist").winControl;
        listView.selection.selectAll();

        //doAppBarShow();
    }

    // Applies to Recent only
    function doClickClearRecent() {
        Data.clearGroup("recent");
        showHideClearRecentButton();
    }

    // Applies to Favorites only
    function doClickAddFavorite() {
        var folderPicker = new Windows.Storage.Pickers.FolderPicker;
        folderPicker.suggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.computerFolder;
        folderPicker.fileTypeFilter.replaceAll(["*"]);
        folderPicker.pickSingleFolderAsync().done(function (folder) {
            if (folder) {
                // Add to the group
                if (!Data.addToGroup(Data.getGroup("favorites"), folder, true)) {
                    var message = "There are already 999 favorites + pinned folders. Remove one before adding another";
                    errorToast("Add favorite", message);
                }
            } else {
                // No folder was selected. Do nothing
            }
        });
    }

    function doClickClearSelection() {
        var listView = document.querySelector(".groupeditemslist").winControl;
        listView.selection.clear();
    }

    function doClickRemove() {
        var listViewSelection = document.querySelector(".groupeditemslist").winControl.selection;
        if (listViewSelection.count() > 0) {
            listViewSelection.getItems().done(function (selectedItems) {
                selectedItems.forEach(function (selectedItem) {
                    Data.removeFromList(selectedItem);
                });
            });

            showHideClearRecentButton();
        }
    }

    /* This function slides the ListView scrollbar into view if occluded by the AppBar (in sticky mode) */
    function doAppBarShow() {
        var appBar = document.getElementById("appBar");

        // Move the scrollbar into view if appbar is sticky
        if (appBar.winControl.sticky) {
            var listView = document.querySelector(".groupeditemslist");
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
            var listView = document.querySelector(".groupeditemslist");
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
        var appBarDiv = document.getElementById("appBar");
        var appBar = appBarDiv.winControl;
        var listView = document.querySelector(".groupeditemslist").winControl;
        var count = listView.selection.count();
        switch (count) {
            case 0:
                // Hide selection commands in AppBar and swap "Clear selection" for "Select all"
                appBar.hide();
                //appBar.hideCommands(appBarDiv.querySelectorAll('.singleSelect'));
                appBar.hideCommands(appBarDiv.querySelectorAll('.multiSelect'));
                appBar.hideCommands(document.getElementById('cmdClearSelection'));
                appBar.sticky = false;
                break;
            case 1:
                // Show selection commands in AppBar (single and multi select) and swap "Select all" for "Clear selection"
                //appBar.showCommands(appBarDiv.querySelectorAll('.singleSelect'));
                appBar.showCommands(appBarDiv.querySelectorAll('.multiSelect'));
                appBar.showCommands(document.getElementById('cmdClearSelection'));
                appBar.sticky = true;
                appBar.show();
                break;
            default:
                // Show selection commands in AppBar (multi select only) and swap "Select all" for "Clear selection"
                //appBar.hideCommands(appBarDiv.querySelectorAll('.singleSelect'));
                appBar.showCommands(appBarDiv.querySelectorAll('.multiSelect'));
                appBar.showCommands(document.getElementById('cmdClearSelection'));
                appBar.sticky = true;
                appBar.show();
                break;
        }
    }
})();
