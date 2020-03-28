//const Nightmare = require('nightmare');
const fs = require('fs').promises;
//const http = require('request');
const config = require('./config.json');


async function runParse() {

    console.log('Running...');
    
    let listReleasesName = await getFileData(config.debug.listReleasesName);
    let migrationsData390 = await getFileData(config.debug.migrations);
    let usedReleases;
    console.log(await fs.access("./updates_data/" + getDate() + ".json"));
    try {
        if (await fs.existsSync("./updates_data/" + getDate() + ".json")) {
            usedReleases = await getFileData("./updates_data/" + getDate() + ".json")
        }
    } catch (e) {
        console.log("[Read Old Save Data] -> File used release not found. Will be using empty data.");
        usedReleases = { updates: {}, videorelease_id: {} };
    }
    
    //console.log(listReleasesName);



    let nowDate = "2020-03-27";//getDate();
    let allTodayUpdates = [];
    for (let i=0; i<migrationsData390.data.length; i++) {
        if (migrationsData390.data[i].attributes.updated_at.indexOf(nowDate) === 0 ) {
            allTodayUpdates.push(migrationsData390.data[i]);
        } else {
            break;
        }
    };
    
    let listAllNames = [];
    for (let i = 0; i < listReleasesName.data.length; i++) {
        if (listReleasesName.data[i].update_data.indexOf(nowDate) === 0) {
            listAllNames.push(listReleasesName.data[i]);
        } else {
            break;
        }
    };
    getUpdatedRelease(usedReleases, allTodayUpdates, listAllNames);

};


function getDate() {
    let today = new Date();
    let dd = today.getDate();
    let mm = today.getMonth() + 1;
    let yyyy = today.getFullYear();
    dd = dd < 10 ? `0${dd}` : dd;
    mm = mm < 10 ? `0${mm}` : mm;
    let nowDate = yyyy + "-" + mm + "-" + dd;
    console.log("Today is: " + nowDate);
    return nowDate;
};


async function getFileData(fileName) {
    try {
        let fileData = await JSON.parse(await fs.readFile(fileName, 'utf8'));
        console.log(`[Read Old Save Data] -> File ${fileName} Read Good =)`);
        return fileData;
    } catch (e) {
        console.log(`[Read Old Save Data] -> Error Read File ${fileName}`);
        console.error(e);
    }
};

async function writeData(text) {
    try {
        await fs.writeFile("./updates_data/" + getDate() + ".json", JSON.stringify(text));
        console.log('[Save Data] -> Done');
    } catch (e) {
        console.log('[Save Data] -> Error: ');
        console.error(e);
    }
}


function getUpdatedRelease(usedReleases, allTodayUpdates, listAllNames) {
    let newReleases = {};
    for (let i = 0; i < allTodayUpdates.length; i++) {
        if (usedReleases.updates.hasOwnProperty(allTodayUpdates[i].id)) {
            continue;
        } else {

            usedReleases.updates[allTodayUpdates[i].id] = {
                videorelease_id: null,
                id_update: allTodayUpdates[i].id,
                name: null
            };
            newReleases[allTodayUpdates[i].id] = {
                videorelease_id: null,
                id_update: allTodayUpdates[i].id,
                name: null
            };

            for (let j = 0; j < listAllNames.length; j++) {
                if (usedReleases.videorelease_id.hasOwnProperty(listAllNames[j].videorelease_id)) {
                    continue;
                } else {
                    usedReleases.updates[allTodayUpdates[i].id] = {
                        videorelease_id: listAllNames[j].videorelease_id,
                        name: listAllNames[j].name
                    };
                    newReleases[allTodayUpdates[i].id] = {
                        videorelease_id: listAllNames[j].videorelease_id,
                        name: listAllNames[j].name
                    };
                    usedReleases.videorelease_id[listAllNames[j].videorelease_id] = { id_update: allTodayUpdates[i].id };
                    break;
                }
            }
        }
    }
    writeData(usedReleases);
    console.log(newReleases);
    return newReleases;
}

// getFileData('json/data.json'); //путь к файлу
runParse();