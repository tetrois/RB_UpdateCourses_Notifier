const Nightmare = require('nightmare');
const fs = require('fs').promises;
const http = require('request');
const config = require('./config.json');


async function runParse() {
    try {
        console.log('Running...');

        let nowDate = getDate();//getDate();

        // let listReleasesName = await getFileData(config.debug.listReleasesName);
        // let migrationsData390 = await getFileData(config.debug.migrations);
        let oldSiteData = await getFileData(config.file.oldData);
        let usedReleases = await getUpdateData(nowDate);
        //let allTodayUpdates = [];


        let nightmare = Nightmare({ show: false, openDevTools: { mode: 'detach' } }); //openDevTools: { mode: 'detach' }


        await login(nightmare);
        let siteData = await listCourses(nightmare);
        siteData = await parseSiteData(siteData, nightmare);
        writeData(siteData);
        let newListCourses = compareData(siteData, oldSiteData);
        let todayMigrations = await parseReleaseData(nightmare, config.rb.idRelease, nowDate);
        let todayReleasesNames = await getReleasesNames(nightmare, nowDate);
        let newReleases = getUpdatedRelease(usedReleases, todayMigrations, todayReleasesNames, nowDate);
        createMessageCourses(newListCourses);
        createMessageReleases(newReleases);
        // sendMessageTG(message, config.telegram.token, config.telegram.debugChat);
        // sendMessageTG(message, config.telegram.token, config.telegram.debugChat);
        await nightmare.end();


    } catch (error) {
        console.log("[Parse] -> Error");
        console.error(error);
    } finally {
        console.log('All Complete');
    }
};

//Получаем текущую дату и фоматируем ее в yyyy-mm-dd
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
    //return "2020-03-30";
};

async function getFileData(fileName) {
    try {
        await fs.access(fileName);
        let fileData = await JSON.parse(await fs.readFile(fileName, 'utf8'));
        console.log(`[Read Old Save Data] -> File ${fileName} Read Good =)`);
        return fileData;
    } catch (e) {
        console.log(`[Read Old Save Data] -> Error Read File ${fileName}`);
        console.error(e);
        return fileData = {}
    }
};

async function writeReleasesData(text, nowDate) {
    try {
        await fs.writeFile(`./updates_data/${nowDate}.json`, JSON.stringify(text));
        console.log('[Save Data] -> Done');
    } catch (error) {
        console.log('[Save Data] -> Error: ');
        console.error(error);
    }
}

async function writeData(text) {
    try {
        await fs.writeFile(config.file.oldData, JSON.stringify(text));
        console.log('[Save Data] -> Done');
    } catch (error) {
        console.log('[Save Data] -> Error: ');
        console.error(error);
    }
}

async function getUpdateData(nowDate) {
    try {
        await fs.access(`./updates_data/${nowDate}.json`);
        return data = await getFileData(`./updates_data/${nowDate}.json`)
    } catch (e) {
        console.log("[Read Releases Data] -> File used release not found. Will be using empty data.");
        return data = { updates: {}, videorelease_id: {} };
    }
}

//Login
async function login(nightmare) {
    try {
        console.log('[Login] -> Start');
        await nightmare
            .goto(config.rb.mainLoginLink)
            .insert('input.form__input.form__input--spaceright[name=user_login]', config.rb.login)
            .insert('input.form__input.form__input--spaceright[name=password]', config.rb.password)
            .click('button.button')
            .wait(3000)
        //.goto(config.rb.coursesListLink)
        console.log('[Login] -> Complete');
    } catch (e) {
        console.log("[Login] -> Error");
        console.error(e);
    }
}

//List courses
async function listCourses(nightmare) {
    try {
        console.log('[List Courses] -> Start');
        nightmare.goto(config.rb.coursesListLink);
        let siteData = await nightmare.evaluate(function () {
            let mainTableStat = document.querySelector('table.table');
            let arrObjects = [];
            for (let i = 1; i < mainTableStat.rows.length; i++) { //mainTableStat.rows.length
                if (mainTableStat.rows[i].innerText.indexOf("Основной курс для Видеорелизов") !== 0) {
                    arrObjects[i] = {
                        name: mainTableStat.rows[i].cells[0].innerText,
                        id: mainTableStat.rows[i].cells[1].innerText.substring(mainTableStat.rows[i].cells[1].innerText.indexOf("/", 28)),
                        idLink: `https://rb.sberbank-school.ru/jsapi/backend/courses/${mainTableStat.rows[i].cells[2].querySelector('a').pathname.replace(/\D+/g, "")}/migrations`
                    }
                }
            }
            return arrObjects;
        });
        console.log('[List Courses] -> Complete, Total: ' + siteData.length);
        return siteData;
    } catch (error) {
        console.log("[List Courses] -> Error");
        console.error(error);
    }
}

async function parseSiteData(siteData, nightmare) {
    try {
        console.log("[Parse] -> Start");
        for (let i = 1; i < siteData.length; i++) { //siteData.length
            console.log(`[Parse] -> URL: ${siteData[i].idLink}`);
            await nightmare.goto(siteData[i].idLink);
            let dateUpdate2 = {};
            dateUpdate2 = await nightmare.evaluate(function () {
                try {
                    let q1 = {};
                    let q2 = JSON.parse(document.querySelector('pre').innerText);
                    q1.id_update = q2.data[0].id;
                    q1.date_update = q2.data[0].attributes.updated_at;
                    console.log(q1);
                    return q1;
                } catch (error) {
                    console.error(error);
                    console.log("Bad Link =(");
                }
            });
            Object.assign(siteData[i], dateUpdate2);
        }
        console.log("[Parse] -> Done");
        return siteData;
    } catch (error) {
        console.log("[Parse] -> Error");
        console.error(error);
    }
}

async function parseReleaseData(nightmare, linkRelease, nowDate) {
    try {
        console.log("[Parse Release] -> Start");
        console.log(`[Parse Release] -> URL: ${linkRelease}`);
        await nightmare.goto(linkRelease);
        let todayMigrations = {};
        todayMigrations = await nightmare.evaluate(function (nowDate) {
            try {
                let allUpdates = JSON.parse(document.querySelector('pre').innerText);
                let todayUpdates = [];
                for (let i = 0; i < allUpdates.data.length; i++) {
                    if (allUpdates.data[i].attributes.crated_at.indexOf(nowDate) === 0) {
                        todayUpdates.push(allUpdates.data[i]);
                    } else {
                        break;
                    }
                };
                return todayUpdates;
            } catch (error) {
                console.log("Bad Link =(");
                console.error(error);
            }
        }, nowDate);
        console.log(`[Parse Release] -> Count releases: ${todayMigrations.length}`);
        console.log("[Parse Release] -> Done");
        return todayMigrations;
    } catch (error) {
        console.log("[Parse Release] -> Error");
        console.error(error);
    }
}

async function getReleasesNames(nightmare, nowDate) {
    try {
        console.log("[Parse Releases name] -> Start");
        console.log(`[Parse Releases name] -> URL: ${config.rb.listReleaseLink}&searchDate[]=${nowDate}+00:00:00&searchDate[]=${nowDate}+23:59:59&dateOrder=desc`);
        await nightmare.goto(`${config.rb.listReleaseLink}&searchDate[]=${nowDate}+00:00:00&searchDate[]=${nowDate}+23:59:59&dateOrder=desc`);
        let todayReleasesNames = [];
        todayReleasesNames = await nightmare.evaluate(() => {
            let listReleasesName = JSON.parse(document.getElementsByTagName("pre")[0].innerText);
            return listReleasesName;
        });
        console.log(`[Parse Releases name] -> Count Release: ${todayReleasesNames.data.length}`);
        console.log("[Parse Releases name] -> Done");
        return todayReleasesNames;
    } catch (error) {
        console.log("[Parse Releases name] -> Error");
        console.error(error);
    }
}

function getUpdatedRelease(usedReleases, allTodayUpdates, listAllNames, nowDate) {
    try {
        let newReleases = {};
        for (let i = 0; i < allTodayUpdates.length; i++) {
            if (usedReleases.updates.hasOwnProperty(allTodayUpdates[i].id)) {
                continue;
            } else {

                usedReleases.updates[allTodayUpdates[i].id] = {
                    videorelease_id: null,
                    id_update: allTodayUpdates[i].id,
                    name: "Обновлена траектория Видеорелизов",
                    crated_at: allTodayUpdates[i].attributes.crated_at
                };
                newReleases[allTodayUpdates[i].id] = {
                    videorelease_id: null,
                    id_update: allTodayUpdates[i].id,
                    name: "Обновлена траектория Видеорелизов",
                    crated_at: allTodayUpdates[i].attributes.crated_at
                };

                for (let j = 0; j < listAllNames.data.length; j++) {
                    if (usedReleases.videorelease_id.hasOwnProperty(listAllNames.data[j].videorelease_id)) {
                        continue;
                    } else {
                        usedReleases.updates[allTodayUpdates[i].id] = {
                            videorelease_id: listAllNames.data[j].videorelease_id,
                            name: listAllNames.data[j].name,
                            crated_at: allTodayUpdates[i].attributes.crated_at
                        };
                        newReleases[allTodayUpdates[i].id] = {
                            videorelease_id: listAllNames.data[j].videorelease_id,
                            name: listAllNames.data[j].name,
                            crated_at: allTodayUpdates[i].attributes.crated_at
                        };
                        usedReleases.videorelease_id[listAllNames.data[j].videorelease_id] = { id_update: allTodayUpdates[i].id };
                        break;
                    }
                }
            }
        }
        writeReleasesData(usedReleases, nowDate);
        console.log("[Get Upd Releases] -> Done");
        return newReleases;
    } catch (error) {
        console.log("[Get Upd Releases] -> Error");
        console.error(error);
    }
}

function compareData(siteData, oldSiteData) {
    try {
        console.log('[Compare] -> Start');
        let newSiteData = [];
        for (let a = 0; a < siteData.length; a++) {
            try {
                console.log(`[Compare] -> ${a}) 1: ${oldSiteData[a].name}  | Old version: ${oldSiteData[a].id_update}`);
                console.log(`[Compare] -> ${a}) 2: ${siteData[a].name}  | New version: ${siteData[a].id_update}`);
                if (oldSiteData[a].id_update !== siteData[a].id_update) {
                    newSiteData.push(siteData[a]);
                }
            } catch (error) {
                console.log('[Compare] -> Name Not Found');
            }
        }
        console.log('[Compare] -> Done');
        return newSiteData;
    } catch (error) {
        console.log("[Compare] -> Error");
        console.error(error);
    }
}

function createMessageCourses(newSiteData) {
    try {
        console.log("[Create Message] -> Start");
        let msg = [];
        for (let h = 0; h < newSiteData.length; h++) {
            msg[h] = "%23"+ encodeURI(`updateTest\nid: ${newSiteData[h].id}\nname: ${newSiteData[h].name}\nDate update: ${newSiteData[h].date_update}`);
        }
        sendMessageTG(msg, config.telegram.token, config.telegram.chatSupport);
        console.log(`[Create Message] -> Done. Count: ${newSiteData.length}`);
        return msg;
    } catch (error) {
        console.log("[Create Message] -> Error");
        console.error(error);
    }
}

function createMessageReleases(newReleases) {
    try {
        console.log("[Create Message R] -> Start");
        let msg = [];
        let i = 0;
        for (let key in newReleases) {
            msg[i++] = "%23" + encodeURI(`update\nid: /rb_videorelease\nname: ${newReleases[key].name}\nDate update: ${newReleases[key].crated_at}`);
        }
        sendMessageTG(msg, config.telegram.token, config.telegram.chatSupport);
        console.log(`[Create Message R] -> Done. Count: ${msg.length}`);
        return msg;
    } catch (error) {
        console.log("[Create Message R] -> Error");
        console.error(error);
    }
}

function sendMessageTG(message, token, chat) {
    for (let i=0; i<message.length; i++) {
        //console.log(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat}&parse_mode=html&text=${message[i]}`);
        http.post(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat}&parse_mode=html&text=${message[i]}`);
    }
}

runParse();
setInterval(runParse, config.interval);