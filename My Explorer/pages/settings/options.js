(function () {
    "use strict";

    var appView = Windows.UI.ViewManagement.ApplicationView;
    var appViewState = Windows.UI.ViewManagement.ApplicationViewState;
    var nav = WinJS.Navigation;
    var ui = WinJS.UI;
    var localSettings = Windows.Storage.ApplicationData.current.localSettings;
    var futureAccessList = Data.getPersistenceGroup("favorites");

    WinJS.UI.Pages.define("/pages/settings/options.html", {
        ready: function (element, options) {
            // Theme
            // Style
            var themeStyleToggleControl = document.getElementById("themeStyleToggle").winControl;
            var themeStyleValue = (localSettings.values["themeStyle"] === "ui-light");
            themeStyleToggleControl.checked = themeStyleValue;
            switchThemeStyle();

            themeStyleToggleControl.addEventListener("change", switchThemeStyle);

            // Folder thumbnail
            var folderThumbnailToggleControl = document.getElementById("folderThumbnailToggle").winControl;
            var folderThumbnailValue = (localSettings.values["folderThumbnail"] === "MyExplorer");
            folderThumbnailToggleControl.checked = folderThumbnailValue;
            switchFolderThumbnail();

            folderThumbnailToggleControl.addEventListener("change", switchFolderThumbnail);

            // Start on
            var startSelectElement = document.getElementById("startOnSelect");
            for (var index = 0; index < startSelectElement.length; index++) {
                var option = startSelectElement.options(index);
                var value = option.value;

                if (value === "favorites" || value === "recent") {
                    option.disabled = (Data.resolveGroupReference(value) === undefined);
                }

                if (value === localSettings.values["startOn"]) {
                    option.selected = true;

                    var customStartOnPathElement = element.querySelector("#customStartOnPath");
                    customStartOnPathElement.textContent = "";
                    if (value === "custom") {
                        customStartOnPathElement.textContent = futureAccessList.entries.filter(function (entry) { return entry.token === "startOn" })[0].metadata;
                    }
                }
            }
            
            startSelectElement.addEventListener("change", this._selectStartOn);

            // Collision option
            // File collision
            var collisionOptionElement = document.getElementById("collisionOptionSelect");
            for (var index = 0; index < collisionOptionElement.length; index++) {
                var option = collisionOptionElement.options(index);
                var value = option.value;

                if (value === localSettings.values["collisionOption"]) {
                    option.selected = true;
                    break;
                }
            }
            collisionOptionElement.addEventListener("change", this._selectCollisionOption);

            // Folder collision
            var folderCollisionOptionElement = document.getElementById("folderCollisionOptionSelect");
            for (var index = 0; index < collisionOptionElement.length; index++) {
                var option = folderCollisionOptionElement.options(index);
                var value = option.value;

                if (value === localSettings.values["folderCollisionOption"]) {
                    option.selected = true;
                    break;
                }
            }
            folderCollisionOptionElement.addEventListener("change", this._selectFolderCollisionOption);

            // Manage list
            var clearRecentButtonElement = document.getElementById("clearRecentGroup");
            clearRecentButtonElement.addEventListener("click", this._clearGroup);
            clearRecentButtonElement.disabled = (Data.resolveGroupReference("recent") === undefined);
        },

        _selectStartOn: function (evt) {
            var startSelectElement = evt.target;
            var customStartOnPathElement = startSelectElement.parentNode.querySelector("#customStartOnPath");
            customStartOnPathElement.textContent = "";
            var startOn = startSelectElement.options(startSelectElement.selectedIndex).value;
            switch (startOn) {
                case "lastFolderOpened":
                    localSettings.values["startOn"] = startOn;
                    break;
                case "custom":
                    // FilePicker APIs will not work if the application is in a snapped state.
                    // If an app wants to show a FilePicker while snapped, it must attempt to unsnap first
                    if ((appView.value !== appViewState.snapped) || appView.tryUnsnap()) {
                        var folderPicker = new Windows.Storage.Pickers.FolderPicker;
                        folderPicker.suggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.computerFolder;
                        folderPicker.fileTypeFilter.replaceAll(["*"]);
                        folderPicker.pickSingleFolderAsync().done(function (folder) {
                            if (folder) {
                                var display = folder.path;
                                if (display === undefined || display === "") {
                                    display = folder.displayName + " " + folder.displayType;
                                }
                                futureAccessList.addOrReplace("startOn", folder, display);
                                localSettings.values["startOn"] = startOn;
                            } else {
                                // No folder was selected, restore the previous setting
                                for (var index = 0; index < startSelectElement.length; index++) {
                                    var option = startSelectElement.options(index);
                                    var value = option.value;

                                    if (value === localSettings.values["StartOn"]) {
                                        option.selected = true;
                                        break;
                                    }
                                }
                            }

                            // Re-open the settings options
                            WinJS.UI.SettingsFlyout.showSettings("options", "/pages/settings/options.html");
                        });
                    }
                    break;
                default:
                    localSettings.values["startOn"] = startOn;
                    break;
            }
        },

        _selectCollisionOption: function (evt) {
            var collisionOptionSelectElement = evt.target;
            var collisionOption = collisionOptionSelectElement.options(collisionOptionSelectElement.selectedIndex).value;
            localSettings.values["collisionOption"] = collisionOption;
        },

        _selectFolderCollisionOption: function (evt) {
            var folderCollisionOptionSelectElement = evt.target;
            var folderCollisionOption = folderCollisionOptionSelectElement.options(folderCollisionOptionSelectElement.selectedIndex).value;
            localSettings.values["folderCollisionOption"] = folderCollisionOption;
        },

        _clearGroup: function (evt) {
            Data.clearGroup("recent");

            var clearRecentButtonElement = document.getElementById("clearRecentGroup");
            clearRecentButtonElement.disabled = (Data.resolveGroupReference("recent") === undefined);

            var appBarDiv = document.getElementById("appBar");
            var appBar = appBarDiv.winControl;
            var clearRecentButton = document.getElementById("cmdClearRecent");
            if (clearRecentButton !== null) {
                if (Data.resolveGroupReference("recent") === undefined) {
                    appBar.hideCommands(clearRecentButton);
                } else {
                    appBar.showCommands(clearRecentButton);
                }
            }
        }
    });
})();
