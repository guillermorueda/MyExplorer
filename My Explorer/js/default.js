(function () {
    "use strict";

    WinJS.Binding.optimizeBindingReferences = true;

    var app = WinJS.Application;
    var activation = Windows.ApplicationModel.Activation;
    var nav = WinJS.Navigation;
    var ui = WinJS.UI;

    app.addEventListener("activated", function (args) {
        if (args.detail.kind === activation.ActivationKind.launch) {
            if (args.detail.previousExecutionState !== activation.ApplicationExecutionState.terminated) {
                // This application has been newly launched.

                var localSettings = Windows.Storage.ApplicationData.current.localSettings;

                // Determine if it's first launch to set default value for settings
                if (localSettings.values["firstLaunch"] === undefined) {
                    localSettings.values["firstLaunch"] = true;
                    Data.addDefaultItems();
                } else {
                    localSettings.values["firstLaunch"] = false;
                }

                if (localSettings.values["themeStyle"] === undefined) {
                    localSettings.values["themeStyle"] = "ui-light";
                }

                if (localSettings.values["folderThumbnail"] === undefined) {
                    localSettings.values["folderThumbnail"] = "MyExplorer";
                }

                if (localSettings.values["startOn"] === undefined) {
                    localSettings.values["startOn"] = "myExplorer";
                }

                if (localSettings.values["showFileNameExtensions"] === undefined) {
                    localSettings.values["showFileNameExtensions"] = false;
                }

                if (localSettings.values["viewThumbnails"] === undefined) {
                    localSettings.values["viewThumbnails"] = true;
                }

                if (localSettings.values["collisionOption"] === undefined) {
                    localSettings.values["collisionOption"] = "generateUniqueName";
                }

                if (localSettings.values["folderCollisionOption"] === undefined) {
                    localSettings.values["folderCollisionOption"] = "openIfExists";
                }

                // Initialize the theme style
                if (localSettings.values["themeStyle"] === "ui-light") {
                    document.styleSheets[0].disabled = false;
                    document.styleSheets[1].disabled = true;
                } else {
                    document.styleSheets[0].disabled = true;
                    document.styleSheets[1].disabled = false;
                }

                // Set the folder thumbnail
                Data.setFolderThumbnailType(localSettings.values["folderThumbnail"]);
                
                // Initialize lists
                Data.populateGroups();

                var futureAccessList = Data.getPersistenceGroup("favorites");
                if (args.detail.arguments !== "") {
                    // A secondary tile was executed
                    futureAccessList.getFolderAsync("pinned" + args.detail.arguments).done(function (item) {
                        if (item) {
                            goToFolder(item);
                        }
                    }, function (error) {
                        // It wasn't possible to retrieve the item from the list (network failure? Item no longer available?). Notify error and go to home (by doing nothing)
                        var message = "The pinned folder could not be accessed. Verify it exists and you have access to it";
                        errorToast("Open pinned folder", message);
                    });
                } else {
                    // The main tile was executed. Go to the "start on" option
                    switch (localSettings.values["startOn"]) {
                        case "myExplorer":
                            // Go to home (by doing nothing)
                            break;
                        case "favorites":
                            goToSection("favorites");
                            break;
                        case "recent":
                            goToSection("recent");
                            break;
                        case "goTo":
                            goTo();
                            break;
                        case "lastFolderOpened":
                            var startOnEntry = futureAccessList.entries.filter(function (entry) { return entry.token === "startOn" })[0];
                            switch (startOnEntry.metadata) {
                                case "home":
                                    // Go to home (by doing nothing)
                                    break;
                                case "favorites":
                                case "recent":
                                    goToSection(startOnEntry.metadata);
                                    break;
                                default:
                                    futureAccessList.getFolderAsync("startOn").done(function (item) {
                                        if (item) {
                                            goToFolder(item);
                                        }
                                    }, function (error) {
                                        // It wasn't possible to retrieve the item from the list (network failure? Item no longer available?). Notify error and go to home (by doing nothing)
                                        var message = "The \"Start on\" folder could not be accessed. Verify it exists and you have access to it";
                                        errorToast("Start on \"last folder opened\"", message);
                                    });
                                    break;
                            }
                            break;
                        case "custom":
                            futureAccessList.getFolderAsync("startOn").done(function (item) {
                                if (item) {
                                    goToFolder(item);
                                }
                            }, function (error) {
                                // It wasn't possible to retrieve the item from the list (network failure? Item no longer available?). Notify error and go to home (by doing nothing)
                                var message = "The \"Start on\" folder could not be accessed. Verify it exists and you have access to it";
                                errorToast("Start on \"custom\"", message);
                            });
                            break;
                    }
                }
            } else {
                // This application has been reactivated from suspension.
            }

            if (app.sessionState.history) {
                nav.history = app.sessionState.history;
            }
            args.setPromise(WinJS.UI.processAll().done(function () {
                if (nav.location) {
                    nav.history.current.initialPlaceholder = true;
                    return nav.navigate(nav.location, nav.state);
                } else {
                    return nav.navigate(Application.navigator.home);
                }
            }));

            app.onsettings = function (args) {
                args.detail.applicationcommands = {
                    "options": { title: "Options", href: "/pages/settings/options.html", },
                    "about": { title: "About", href: "/pages/settings/about.html", },
                };
                WinJS.UI.SettingsFlyout.populateSettings(args);
            };
        }
    });

    app.oncheckpoint = function (args) {
        // This application is about to be suspended.
        
        // TODO: Save any state that needs to persist across suspensions here.
        // If you need to complete an asynchronous operation before your application is suspended, call args.setPromise().
        app.sessionState.history = nav.history;
    };

    app.start();
})();


// Header Menu

// Place the menu under the title and aligned to the left of it
function showHeaderMenu() {
    // Disable some options depending on the current page
    document.getElementById("favoritesMenuItem").disabled = (Data.resolveGroupReference("favorites") === undefined);
    document.getElementById("recentMenuItem").disabled = (Data.resolveGroupReference("recent") === undefined);

    var title = document.querySelector("header .titlearea");
    var menu = document.getElementById("headerMenu").winControl;
    menu.anchor = title;
    menu.placement = "bottom";
    menu.alignment = "left";

    menu.show();
}

// Settings

function switchThemeStyle(evtArgs) {
    var optionsSettings = document.querySelector("div .win-settingsflyout");
    var optionsContent = WinJS.Utilities.query("div .win-content", optionsSettings)[0];
    var themeStyle = new WinJS.UI.ToggleSwitch(document.getElementById("themeStyleToggle"));

    if (themeStyle.checked) {
        document.styleSheets[0].disabled = false;
        document.styleSheets[1].disabled = true;

        WinJS.Utilities.removeClass(optionsContent, "win-ui-dark");
        WinJS.Utilities.addClass(optionsContent, "win-ui-light");

        Windows.Storage.ApplicationData.current.localSettings.values["themeStyle"] = "ui-light";
    } else {
        document.styleSheets[0].disabled = true;
        document.styleSheets[1].disabled = false;

        WinJS.Utilities.removeClass(optionsContent, "win-ui-light");
        WinJS.Utilities.addClass(optionsContent, "win-ui-dark");

        Windows.Storage.ApplicationData.current.localSettings.values["themeStyle"] = "ui-dark"; 
    }

    if (evtArgs) {
        var listViewElement = (document.querySelector(".groupeditemslist")) ? document.querySelector(".groupeditemslist") : (document.querySelector(".itemslist")) ? document.querySelector(".itemslist") : document.querySelector(".itemdetaillist");
        var listViewControl = listViewElement.winControl;
        listViewElement.style.display.visibility = "none";
        listViewElement.style.display.visibility = "display";
        listViewControl.forceLayout();
    }
}

function switchFolderThumbnail(evtArgs) {
    if (evtArgs) {
        var folderThumbnail = (evtArgs.target.winControl.checked) ? "MyExplorer" : "Desktop";
        Data.setFolderThumbnailType(folderThumbnail);

        var listViewElement = (document.querySelector(".groupeditemslist")) ? document.querySelector(".groupeditemslist") : (document.querySelector(".itemslist")) ? document.querySelector(".itemslist") : document.querySelector(".itemdetaillist");
        var listViewControl = listViewElement.winControl;
        listViewElement.style.display.visibility = "none";
        listViewElement.style.display.visibility = "display";
        listViewControl.forceLayout();
    } else {
        Data.setFolderThumbnailType(Windows.Storage.ApplicationData.current.localSettings.values["folderThumbnail"]);
    }
}

// Helpers

function goToSection(section) {
    if (section === "home") {
        WinJS.Navigation.navigate("/pages/groupedItems/groupedItems.html");
    } else {
        WinJS.Navigation.navigate("/pages/groupDetail/groupDetail.html", { groupKey: section });
    }
}

function goToFolder(folder) {
    WinJS.Navigation.navigate("/pages/itemDetail/itemDetail.html", { item: folder });
}

function goTo() {
    var folderPicker = new Windows.Storage.Pickers.FolderPicker;
    folderPicker.suggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.computerFolder;
    folderPicker.fileTypeFilter.replaceAll(["*"]);
    folderPicker.pickSingleFolderAsync().done(function (folder) {
        if (folder) {
            // Add to the Recent group
            var group = Data.getGroup("recent");
            Data.addToGroup(group, folder, true);

            // Navigate to the folder
            goToFolder(folder);
        } else {
            // No folder was selected. Do nothing
        }
    });
}

function getSelectionRect(element) {
    var selectionRect = element.getBoundingClientRect();

    var rect = {
        x: getClientCoordinates(selectionRect.left),
        y: getClientCoordinates(selectionRect.top),
        width: getClientCoordinates(selectionRect.width),
        height: getClientCoordinates(selectionRect.height)
    };

    return rect;
}

function getClientCoordinates(cssUnits) {
    // Translate css coordinates to system coordinates.
    return cssUnits * (96 / window.screen.deviceXDPI);
}

function errorToast(title, message) {
    toast("Error: " + title, message);
}

function warningToast(title, message) {
    toast("Warning: " + title, message);
}

function informationToast(title, message) {
    toast("Information: " + title, message);
}

function toast(title, message) {
    var Notifications = Windows.UI.Notifications;

    // Get the toast manager
    var notificationManager = Notifications.ToastNotificationManager;

    // getTemplateContent returns a Windows.Data.Xml.Dom.XmlDocument object containing the toast XML
    var toastXml = notificationManager.getTemplateContent(Notifications.ToastTemplateType.toastText02);//toastImageAndText02);

    // Use the methods from the XML document to specify all the required parameters for the toast
    var textNodes = toastXml.getElementsByTagName("text");
    textNodes[0].appendChild(toastXml.createTextNode(title));
    textNodes[1].appendChild(toastXml.createTextNode(message));
    //var toastImageElements = toastXml.getElementsByTagName("image");
    //toastImageElements[0].setAttribute("src", "ms-appx:///images/folder.png");
    //toastImageElements[0].setAttribute("alt", "Error");

    // Create a toast from the XML, then create a ToastNotifier object to send the toast
    var toast = new Notifications.ToastNotification(toastXml);

    notificationManager.createToastNotifier().show(toast);
}