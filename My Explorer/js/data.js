(function () {
    "use strict";

    var localSettings = Windows.Storage.ApplicationData.current.localSettings;

    var favoritesPersistenceGroup = Windows.Storage.AccessCache.StorageApplicationPermissions.futureAccessList;
    var recentPersistenceGroup = Windows.Storage.AccessCache.StorageApplicationPermissions.mostRecentlyUsedList;

    var favoritesGroupDescription = "<p>These items are the ones that you selected as favorites. Keep here those folders that are most frequently used.</p><p>You can add up to 999 favorites + pinned items. After the quota is met, you'll need to manually remove at least one item (favorite or pinned) in order to be able to add another one.</p><p>The date/time provided in each folder corresponds to the date/time in which the folder was added to this list. The list is ordered by this date in a descending order (from newest to oldest)</p>";
    var recentGroupDescription = "<p>These items are the ones that you opened recently (using the 'Go to' option). My Explorer keeps the most recently used items as a temporary history for easy future access.</p><p>Up to 25 items will be kept in this list. After the list is full, the application will automatically delete the oldest item in order to be able to add the most recently opened one.</p><p>The date/time provided with each folder corresponds to the date/time in which the folder was added to this list. The list is ordered by this date in a descending order (from newest to oldest)</p>";

    var favoritesGroupImage = "images/favorites_group.png";
    var favoritesThumbnail = "images/favorites.png";

    var recentGroupImage = "images/recent_group.png";
    var recentThumbnail = "images/recent.png";

    var folderThumbnail = "images/folder.png";
    var folderThumbnailType = "MyExplorer";

    var favoritesGroup = { key: "favorites", title: "Favorites", thumbnail: favoritesThumbnail, path: "", description: favoritesGroupDescription, image: favoritesGroupImage };
    var recentGroup = { key: "recent", title: "Recent", thumbnail: recentThumbnail, path: "", description: recentGroupDescription, image: recentGroupImage };

    var list = new WinJS.Binding.List();
    var groupedItems = list.createSorted(groupSorterSelector).createGrouped(groupKeySelector, groupDataSelector);

    var cutItems = [];

    var numberOfItemsToMove = [];
    var numberOfItemsMoved = [];
    var foldersToMove = [];

    WinJS.Namespace.define("Data", {
        getPersistenceGroup: getPersistenceGroup,
        isPersistenceGroupFull: isPersistenceGroupFull,
        getItems: getItems,
        getGroups: getGroups,
        getGroup: getGroup,
        getItemFromGroup: getItemFromGroup,
        isItemInGroup: isItemInGroup,
        getPersistedItem: getPersistedItem,
        getItemReference: getItemReference,
        getItemsFromGroup: getItemsFromGroup,
        resolveGroupReference: resolveGroupReference,
        resolveItemReference: resolveItemReference,
        addDefaultItems: addDefaultItems,
        populateGroups: populateGroups,
        addToGroup: addToGroup,
        addPinnedFolder: addPinnedFolder,
        removeFromList: removeFromList,
        removePinnedFolder: removePinnedFolder,
        clearGroup: clearGroup,
        getFolderThumbnail: getFolderThumbnail,
        setFolderThumbnailType: setFolderThumbnailType,
        getCutItems: getCutItems,
        setCutItems: setCutItems,
        getCutItem: getCutItem,
        generateToken: generateToken,
        generatePinId: generatePinId,
        resetMoveOptions: resetMoveOptions,
        moveFolder: moveFolder,
        moveOrCopyFolder: moveOrCopyFolder
    });

    function getPersistenceGroup(groupKey) {
        return (groupKey === "favorites") ? favoritesPersistenceGroup : recentPersistenceGroup;
    }

    function groupSorterSelector(item1, item2) {
        var returnValue = -1;
        if (item2) {
            var item1Time = item1.time;
            var item2Time = item2.time;

            if (item1Time === item2Time) {
                returnValue = 0;
            } else if (item1Time > item2Time) {
                returnValue = 1;
            } else if (item1Time < item2Time) {
                returnValue = -1;
            }
        }

        // Default order is descending, so inverting result
        return -returnValue;
    }
    
    function groupKeySelector(item) {
        return item.group.key;
    };

    function groupDataSelector(item) {
        return item.group;
    }

    function getItems() {
        return groupedItems;
    }

    function getGroups() {
        return groupedItems.groups;
    }

    function getGroup(groupKey) {
        return (groupKey === "favorites") ? favoritesGroup : recentGroup;
    }

    function getItemFromGroup(item, group) {
        var filteredItem = groupedItems.filter(function (currentItem) { return currentItem.group.key === group.key && currentItem.key.substring(0, currentItem.key.indexOf("|")) === item.folderRelativeId; }); 
        return filteredItem[0];
    }

    function isItemInGroup(item, group) {
        return (getItemFromGroup(item, group) !== undefined);
    }

    function getPersistedItem(groupKey, itemToken) {
        var persistenceGroup = (groupKey === "favorites") ? favoritesPersistenceGroup : recentPersistenceGroup;
        return persistenceGroup.getFolderAsync(itemToken);
    }

    function getItemReference(item) {
        return [item.group.key, item.key];
    }

    // This function returns a WinJS.Binding.List containing only the items
    // that belong to the provided group.
    function getItemsFromGroup(group) {
        return list.createFiltered(function (item) { return ((group !== undefined) && (item.group.key === group.key)); }).createSorted(groupSorterSelector);
    }

    // Get the unique group corresponding to the provided group key.
    function resolveGroupReference(key) {
        for (var i = 0; i < groupedItems.groups.length; i++) {
            if (groupedItems.groups.getAt(i).key === key) {
                return groupedItems.groups.getAt(i);
            }
        }
    }

    function resolveItemReference(reference) {
        for (var i = 0; i < groupedItems.length; i++) {
            var item = groupedItems.getAt(i);
            if (item.group.key === reference[0] && item.key === reference[1]) {
                return item;
            }
        }
    }

    // Create some default favorites (invoked only the first time the app is launched after installed)
    function addDefaultItems() {
        addToGroup(favoritesGroup, Windows.Storage.KnownFolders.videosLibrary, false);
        addToGroup(favoritesGroup, Windows.Storage.KnownFolders.picturesLibrary, false);
        addToGroup(favoritesGroup, Windows.Storage.KnownFolders.musicLibrary, false);
    }

    // Generates an array of data that is added to the application's data list. 
    function populateGroups() {
        favoritesPersistenceGroup.entries.filter(function (entry) { return (entry.token !== "startOn" && entry.token.indexOf("pinned") !== 0) }).forEach(function (entry) {
            favoritesPersistenceGroup.getItemAsync(entry.token).done(function (item) {
                if (item) {
                    // The item was provided from the list. Add it to the list
                    var time = entry.metadata.substring(0, entry.metadata.indexOf("|"));
                    var date = new Date();
                    date.setTime(time);
                    addToList(favoritesGroup, item, date, entry.token);

                    // Refresh the metadata in the item, in case it has changed
                    var metadata = time + "|" + item.folderRelativeId + "|" + item.displayName + "|" + item.path;
                    favoritesPersistenceGroup.addOrReplace(entry.token, item, metadata);
                }
            }, function (error) {
                // It wasn't possible to retrieve the item from the list (network failure? Item no longer available?). Create a dummy item on the list with the metadata
                addDummyToList(favoritesGroup, entry);
            });
        });

        recentPersistenceGroup.entries.forEach(function (entry) {
            recentPersistenceGroup.getItemAsync(entry.token).done(function (item) {
                if (item) {
                    // The item was provided from the list. Add it to the list
                    var time = entry.metadata.substring(0, entry.metadata.indexOf("|"));
                    var date = new Date();
                    date.setTime(time);
                    addToList(recentGroup, item, date, entry.token);

                    // Refresh the metadata in the item, in case it has changed
                    var metadata = time + "|" + item.folderRelativeId + "|" + item.displayName + "|" + item.path;
                    recentPersistenceGroup.addOrReplace(entry.token, item, metadata);
                }
            }, function (error) {
                // It wasn't possible to retrieve the item from the list (network failure? Item no longer available?). Create a dummy item on the list with the metadata
                addDummyToList(recentGroup, entry);
            });
        });

        // Register event for items removed from recent (when it's full)
        recentPersistenceGroup.addEventListener("itemremoved", recentRemoved);
    }

    // Adds an item to the corresponding group
    function addToGroup(group, item, doAddToList) {
        var date = new Date();

        var persistenceGroup = (group.key === "favorites") ? favoritesPersistenceGroup : recentPersistenceGroup;
        var metadata = date.getTime() + "|" + item.folderRelativeId + "|" + item.displayName + "|" + item.path;
        var token = generateToken(item);
        
        var addedToGroup = false;
        try {
            persistenceGroup.addOrReplace(token, item, metadata);

            if (doAddToList) {
                // Add to the list
                addToList(group, item, date, token);
            }

            addedToGroup = true;
        } catch (error) {
            addedToGroup = false;
        }
        return addedToGroup;
    }

    // Creates a dummy item and invokes addtoList with it
    function addDummyToList(groupInfo, entryInfo) {
        var metadataInfo = entryInfo.metadata.split("|");
        var time = metadataInfo[0];
        var date = new Date();
        date.setTime(time);
        var dummyFolderRelativeId = metadataInfo[1];
        var dummyName = metadataInfo[2];
        var dummyPath = metadataInfo[3];
        var dummyItem = { folderRelativeId: dummyFolderRelativeId, displayName: dummyName, path: dummyPath };
        addToList(groupInfo, dummyItem, date, entryInfo.token);
    }

    // Adds an item to the corresponding list
    function addToList(group, item, date, token) {
        var key = item.folderRelativeId + "|" + token;

        // Verify the item is not already on the list. In this case, the returned token should be the same as the previous one
        var itemOnList = list.filter(function (currentItem) { return currentItem.group.key === group.key && currentItem.key === key; });
        if (itemOnList[0]) {
            // Delete previous item from list (if any) to guarantee a refresh of the data
            list.splice(list.indexOf(itemOnList[0]), 1);
        }

        var thumbnail = (group.key === "favorites") ? favoritesThumbnail : recentThumbnail;
        list.push({ group: group, key: key, title: item.displayName, thumbnail: thumbnail, path: item.path, folder: item, time: date.getTime(), date: date.toLocaleString() });
    }

    // Adds a pinned item to the favorites persistence list
    function addPinnedFolder(item) {
        var date = new Date();

        var metadata = date.getTime() + "|" + item.folderRelativeId + "|" + item.displayName + "|" + item.path;
        var token = "pinned" + generateToken(item);

        var addedToGroup = false;
        try {
            favoritesPersistenceGroup.addOrReplace(token, item, metadata);

            addedToGroup = true;
        } catch (error) {
            addedToGroup = false;
        }
        return addedToGroup;
    }

    // Removes an item from the corresponding list
    function removeFromList(listItem) {
        var actualItem = (listItem.data !== undefined) ? listItem.data : listItem;
        groupedItems.splice(groupedItems.indexOf(actualItem), 1);

        removeFromGroup(actualItem);
    }

    // Removes an item from the corresponding group
    function removeFromGroup(item) {
        var persistenceGroup = (item.group.key === "favorites") ? favoritesPersistenceGroup : recentPersistenceGroup;
        var token = item.key.substring(item.key.indexOf("|") + 1);
        persistenceGroup.remove(token);
    }

    // Removes all items from the corresponding group list
    function removeAllGroupFromList(group) {
        // To remove the items, call remove on the itemDataSource passing in the key
        getItemsFromGroup(group).forEach(function (currentItem) {
            var currentItemIndex = groupedItems.indexOf(currentItem);
            groupedItems.dataSource.itemFromIndex(currentItemIndex).done(function (currentItemInListView) {
                removeFromList(currentItemInListView);
            });
        });
    }

    // Removes a pinned item from the favorites persistence group
    function removePinnedFolder(item) {
        var token = "pinned" + generateToken(item);
        favoritesPersistenceGroup.remove(token);
    }

    // Handle the MRU removed event
    function recentRemoved(eventArgs) {
        var currentRecentItems = getItemsFromGroup(recentGroup);
        if (currentRecentItems.length > recentPersistenceGroup.maximumItemsAllowed) {
            getItemsFromGroup(recentGroup).pop();
        }
    }

    // Removes all items from the corresponding group list
    function clearGroup(groupKey) {
        removeAllGroupFromList(resolveGroupReference(groupKey));
    }

    function isPersistenceGroupFull(groupKey) {
        var persistenceGroup = (groupKey === "favorites") ? favoritesPersistenceGroup : recentPersistenceGroup;
        return persistenceGroup.entries.size === persistenceGroup.maximumItemsAllowed;
    }

    // Gets the folder thumbnail value
    function getFolderThumbnail() {
        return folderThumbnail;
    }

    // Sets the folder thumbnail variable
    function setFolderThumbnailType(value) {
        if (folderThumbnailType !== value) {
            var folderThumbnailPostfix = (value === "MyExplorer") ? "" : "_desktop";

            favoritesThumbnail = "images/favorites" + folderThumbnailPostfix + ".png";
            favoritesGroup.thumbnail = favoritesThumbnail;

            recentThumbnail = "images/recent" + folderThumbnailPostfix + ".png";
            recentGroup.thumbnail = recentThumbnail;

            folderThumbnail = "images/folder" + folderThumbnailPostfix + ".png";
            folderThumbnailType = value;
            localSettings.values["folderThumbnail"] = folderThumbnailType;

            list.forEach(function (entry) {
                if (entry.group.key === "favorites") {
                    entry.group.thumbnail = favoritesThumbnail;
                } else {
                    entry.group.thumbnail = recentThumbnail;
                }

                var currentThumbnailPrefixIndex = entry.thumbnail.indexOf("_desktop");
                if (currentThumbnailPrefixIndex === -1) {
                    currentThumbnailPrefixIndex = entry.thumbnail.indexOf(".");
                }
                var thumbnailPrefix = entry.thumbnail.substring(0, currentThumbnailPrefixIndex);
                entry.thumbnail = thumbnailPrefix + folderThumbnailPostfix + ".png";
            });

            list.notifyReload();
        }
    }

    function getCutItems() {
        return cutItems;
    }

    function setCutItems(cutItemsData) {
        cutItems = cutItemsData;
    }

    function getCutItem(cutItemFolderRelativeId) {
        for (var indexCutItems = 0; indexCutItems < cutItems.length; indexCutItems++) {
            var currentCutItem = cutItems[indexCutItems];
            if (currentCutItem.folderRelativeId === cutItemFolderRelativeId) {
                cutItems.splice(indexCutItems, 1);
                return currentCutItem;
            }
        }
    }

    // Generates a unique token for the item
    function generateToken(item) {
        // Persistence lists doesn't support backslash character, so replacing it for a supported one
        return item.folderRelativeId.replace(/\\/g, "|");
    }

    // Generates a unique pin id for the item
    function generatePinId(item) {
        // Item id doesn't support special characters, so replacing it for a supported one. Adding a prefix
        return ("pinned" + generateToken(item).replace(/[^A-z&^0-9&^.&^_]/g, "_")).substring(0, 64);
    }

    function resetMoveOptions() {
        // Before starting a group of moves, reset arrays
        numberOfItemsToMove = [];
        numberOfItemsMoved = [];
        foldersToMove = [];
    }

    function moveFolder(sourceFolder, currentFolder, fromOperation) {
        var topFolderPosition = foldersToMove.length;
        numberOfItemsToMove[topFolderPosition] = 0;
        numberOfItemsMoved[topFolderPosition] = 0;
        foldersToMove[topFolderPosition] = [];

        var queryOptions = new Windows.Storage.Search.QueryOptions();
        queryOptions.folderDepth = Windows.Storage.Search.FolderDepth.deep;

        var query = sourceFolder.createItemQueryWithOptions(queryOptions);
        query.getItemCountAsync().done(function (numItemsMove) {
            numberOfItemsToMove[topFolderPosition] = numItemsMove;
            moveOrCopyFolder(sourceFolder, currentFolder, fromOperation, topFolderPosition);
        });
    }

    function moveOrCopyFolder(sourceFolder, currentFolder, fromOperation, topFolderPosition) {
        if (fromOperation === "Move to" || fromOperation === "Cut") {
            // Add the folder to the list of folders to delete
            foldersToMove[topFolderPosition][foldersToMove[topFolderPosition].length] = sourceFolder;
        }

        // Create/open destination folder or fail
        currentFolder.createFolderAsync(sourceFolder.name, Windows.Storage.CreationCollisionOption[localSettings.values["folderCollisionOption"]]).then(function (destinationFolder) {
            // Success
            // Enumerate folder items
            sourceFolder.getFilesAsync().then(function (sourceFolderSubFiles) {
                sourceFolderSubFiles.forEach(function (sourceFolderSubFile) {
                    // Move/copy files into destination folder
                    var moveOrCopyOperation = null;
                    if (fromOperation === "Move to" || fromOperation === "Cut") {
                        var moveOrCopyOperation = sourceFolderSubFile.moveAsync(destinationFolder, sourceFolderSubFile.name, Windows.Storage.NameCollisionOption[localSettings.values["collisionOption"]]);

                        // Increase items counter
                        numberOfItemsMoved[topFolderPosition]++;
                    } else {
                        var moveOrCopyOperation = sourceFolderSubFile.copyAsync(destinationFolder, sourceFolderSubFile.name, Windows.Storage.NameCollisionOption[localSettings.values["collisionOption"]]);
                    }
                    moveOrCopyOperation.done(function (newFile) {
                        // Success
                    }, function (error) {
                        var message = "Error " + ((fromOperation === "Cut" || fromOperation === "Copy") ? "pasting" : ((fromOperation === "Move to") ? "moving" : "copying")) + " file (" + error.message + ")";
                        errorToast(((fromOperation === "Cut" || fromOperation === "Copy") ? "Paste" : fromOperation), message);
                    });
                });

                return sourceFolder.getFoldersAsync();
            }).done(function (sourceFolderSubFolders) {
                if ((fromOperation === "Move to" || fromOperation === "Cut") && (numberOfItemsMoved[topFolderPosition] === numberOfItemsToMove[topFolderPosition])) {
                    // If all the items were copied (or tried to be copied), delete the original folders (if empty)
                    deleteEmptyFoldersAfterMove(foldersToMove[topFolderPosition].length - 1, fromOperation, topFolderPosition);
                } else {
                    // Recursively repeat with each subfolder
                    sourceFolderSubFolders.forEach(function (sourceFolderSubFolder) {
                        if (fromOperation === "Move to" || fromOperation === "Cut") {
                            // Increase items counter
                            numberOfItemsMoved[topFolderPosition]++;
                        }

                        moveOrCopyFolder(sourceFolderSubFolder, destinationFolder, fromOperation, topFolderPosition);
                    });
                }
            });
        }, function (error) {
            var message = sourceFolderSubFolder.name + ". ";
            switch (error.number) {
                case -2147024713:
                    message = "Cannot create a folder when the name already exists";
                    break;
                default:
                    message = error.message;
            }
            errorToast(((fromOperation === "Cut" || fromOperation === "Copy") ? "Paste" : fromOperation), message);
        });
    }

    function deleteEmptyFoldersAfterMove(movedFolderPosition, fromOperation, topFolderPosition) {
        // Verify the folder is empty/not-empty of files
        foldersToMove[topFolderPosition][movedFolderPosition].createItemQuery().getItemCountAsync().done(function (numItemsRemaining) {
            // If the folder is empty, delete, if not, there was an error so leave it
            if (numItemsRemaining === 0) {
                foldersToMove[topFolderPosition][movedFolderPosition].deleteAsync(Windows.Storage.StorageDeleteOption.permanentDelete).then(function () {
                    // Success
                }, function (error) {
                    // Error
                }).done(function () {
                    movedFolderPosition--;
                    if (movedFolderPosition >= 0) {
                        deleteEmptyFoldersAfterMove(movedFolderPosition, fromOperation, topFolderPosition);
                    }
                });
            } else {
                movedFolderPosition--;
                if (movedFolderPosition >= 0) {
                    deleteEmptyFoldersAfterMove(movedFolderPosition, fromOperation, topFolderPosition);
                }
            }
        });
    }
})();
