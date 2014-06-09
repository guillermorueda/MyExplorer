(function () {
    "use strict";

    var appViewState = Windows.UI.ViewManagement.ApplicationViewState;
    var nav = WinJS.Navigation;
    var ui = WinJS.UI;

    var localSettings = Windows.Storage.ApplicationData.current.localSettings;
    var group = null;

    ui.Pages.define("/pages/groupDetail/groupDetail.html", {
        /// <field type="WinJS.Binding.List" />
        _items: null,

        // This function is called whenever a user navigates to this page. It
        // populates the page elements with the app's data.
        ready: function (element, options) {
            group = Data.getGroup(options.groupKey);

            // Define the header menu
            initHeaderMenu();

            // Define appBar
            initAppBar();

            var listView = element.querySelector(".itemslist").winControl;
            this._items = Data.getItemsFromGroup(group);
            var pageList = this._items.createGrouped(
                function groupKeySelector(item) { return group.key; },
                function groupDataSelector(item) { return group; }
            );

            var titleElement = element.querySelector("header[role=banner] .pagetitle");
            titleElement.textContent = group.title;

            listView.itemDataSource = pageList.dataSource;
            listView.itemTemplate = element.querySelector(".itemtemplate");
            listView.groupDataSource = pageList.groups.dataSource;
            listView.groupHeaderTemplate = element.querySelector(".headertemplate");
            listView.oniteminvoked = this._itemInvoked.bind(this);

            this._initializeLayout(listView, Windows.UI.ViewManagement.ApplicationView.value);
            listView.element.focus();

            if (localSettings.values["startOn"] !== "custom") {
                // The group folder is not an actual folder. In order to be able to insert metadata in the futureAccessList, the picturesLibrary is used as item. It'll be ignored on load
                Data.getPersistenceGroup("favorites").addOrReplace("startOn", Windows.Storage.KnownFolders.picturesLibrary, group.key);
            }

            // Enable share as a source
            var dataTransferManager = Windows.ApplicationModel.DataTransfer.DataTransferManager.getForCurrentView();
            dataTransferManager.addEventListener("datarequested", dataRequested);
        },

        unload: function () {
            this._items.dispose();

            // Disable share as a source
            var dataTransferManager = Windows.ApplicationModel.DataTransfer.DataTransferManager.getForCurrentView();
            dataTransferManager.removeEventListener("datarequested", dataRequested);
        },

        // This function updates the page layout in response to viewState changes.
        updateLayout: function (element, viewState, lastViewState) {
            /// <param name="element" domElement="true" />

            var listView = element.querySelector(".itemslist").winControl;
            if (lastViewState !== viewState) {
                if (lastViewState === appViewState.snapped || viewState === appViewState.snapped) {
                    var handler = function (e) {
                        listView.removeEventListener("contentanimating", handler, false);
                        e.preventDefault();
                    }
                    listView.addEventListener("contentanimating", handler, false);
                    var firstVisible = listView.indexOfFirstVisible;
                    this._initializeLayout(listView, viewState);
                    if (firstVisible >= 0 && listView.itemDataSource.list.length > 0) {
                        listView.indexOfFirstVisible = firstVisible;
                    }
                }
            }
        },

        // This function updates the ListView with new layouts
        _initializeLayout: function (listView, viewState) {
            /// <param name="listView" value="WinJS.UI.ListView.prototype" />

            var appBar = document.getElementById("appBar").winControl;

            if (viewState === appViewState.snapped) {
                listView.layout = new ui.ListLayout();

                document.getElementById("goToMenuItem").disabled = true;

                if (group.key === "favorites") {
                    appBar.hideCommands(document.getElementById('cmdAddFavorite'));
                }
            } else {
                listView.layout = new ui.GridLayout({ groupHeaderPosition: "left" });

                document.getElementById("goToMenuItem").disabled = false;

                if (group.key === "favorites") {
                    appBar.showCommands(document.getElementById('cmdAddFavorite'));
                }
            }

            // Add appBar event listener and display/hide it and the items
            listView.addEventListener("selectionchanged", doSelectItem);
            doSelectItem();
        },

        _itemInvoked: function (args) {
            var item = this._items.getAt(args.detail.itemIndex);

            // To guarantee the folder is still accessible. Try to reload the folder in the app before navigating to it
            var groupKey = group.key;
            var itemToken = item.key.substring(item.key.indexOf("|") + 1);
            Data.getPersistedItem(groupKey, itemToken).done(function (folder) {
                nav.navigate("/pages/itemDetail/itemDetail.html", { item: folder });
            }, function (error) {
                var message = "The folder could not be accessed. Verify it exists and you have access to it";
                errorToast("Open folder", message);
            });
        }
    });

    function dataRequested(eventArgs) {
        var request = eventArgs.request;

        var listView = document.querySelector(".itemslist").winControl;
        var listViewSelection = listView.selection;
        var count = listViewSelection.count();
        if (count === 0) {
            request.failWithDisplayText("Select the files you would like to share and try again");
        } else {
            request.failWithDisplayText("Folders are not supported for sharing. Select only files you would like to share and try again");
        }
    }

    function showHideClearRecentButton() {
        // Evaluate show/hide of recent button only if on recent group
        if (group.key === "recent") {
            var appBarDiv = document.getElementById("appBar");
            var appBar = appBarDiv.winControl;

            var clearRecentButton = document.getElementById("cmdClearRecent");
            if (Data.resolveGroupReference("recent") === undefined) {
                appBar.hideCommands(clearRecentButton);
            } else {
                appBar.showCommands(clearRecentButton);
            }
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

        // Hide the commands that don't match the current group
        if (group.key === "favorites") {
            appBar.hideCommands(document.getElementById('cmdClearRecent'));
        } else {
            appBar.hideCommands(document.getElementById('cmdAddFavorite'));
        }

        // Show/hide clear recent group button
        showHideClearRecentButton();
    }

    function doClickSelectAll() {
        var listView = document.querySelector(".itemslist").winControl;
        listView.selection.selectAll();

        //doAppBarShow();
    }

    // Applies to Recent only
    function doClickClearRecent() {
        Data.clearGroup(group.key);
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
                if (!Data.addToGroup(group, folder, true)) {
                    var message = "There are already 999 favorites + pinned folders. Remove one before adding another";
                    errorToast("Add favorite", message);
                }
            } else {
                // No folder was selected. Do nothing
            }
        });
    }

    function doClickClearSelection() {
        var listView = document.querySelector(".itemslist").winControl;
        listView.selection.clear();
    }

    function doClickRemove() {
        var listViewSelection = document.querySelector(".itemslist").winControl.selection;
        if (listViewSelection.count() > 0) {
            listViewSelection.getItems().done(function (selectedItems) {
                selectedItems.forEach(function (selectedItem) {
                    Data.removeFromList(selectedItem);
                });
            });
        }
    }

    /* This function slides the ListView scrollbar into view if occluded by the AppBar (in sticky mode) */
    function doAppBarShow() {
        var appBar = document.getElementById("appBar");

        // Move the scrollbar into view if appbar is sticky
        if (appBar.winControl.sticky) {
            var listView = document.querySelector(".itemslist");
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
            var listView = document.querySelector(".itemslist");
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
        var listView = document.querySelector(".itemslist").winControl;
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
