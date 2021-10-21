//R - Релизы
//E - Экспресс курсы
//RE - функционал относящийся и к релизам и к экспрессам
//TG - Telegram
const dotenv = require('dotenv');
const fs = require('fs').promises;
const http = require('request');
const fetch = require('node-fetch');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const result = dotenv.config();
if (result.error) {
    throw result.error
}
const CONFIG = result.parsed;
let messageSend = false;
let authData = {};


async function runParse() {
    try {
        console.log('Running...');

        let nowDate = getDate();

        let oldSiteData = await getFileData(CONFIG.PATH_FILE_OLD_DATA);
        let usedReleases = await getUpdateData(nowDate, "R");
        let usedExpress = await getUpdateData(nowDate, "E");
        makeUpdateFolder();

        await checkCookie();

        //Механика курсов
        let siteData = await listCourses();
        siteData = await parseSiteData(siteData);
        let newListCourses = compareData(siteData, oldSiteData);
        writeData(siteData);
        createMessageCourses(newListCourses, messageSend);

        //Механика релизов
        let todayMigrationsR = await getDataRE(CONFIG.RB_API_ID_RELEASES_LINK, 'R', 'updates');
        let todayReleasesNames = await getDataRE(CONFIG.RB_API_RELEASES_LINK, 'R', 'names');
        let newReleases = await getUpdatedRE(usedReleases, todayMigrationsR, todayReleasesNames, 'R', nowDate);
        createMessageRE(newReleases, 'R', messageSend);

        //Механика экспрессов
        let todayMigrationsE = await getDataRE(CONFIG.RB_API_ID_EXPRESS_LINK, 'E', 'updates');
        let todayExpressNames = await getDataRE(CONFIG.RB_API_EXPRESS_LINK, 'E', 'names');
        let newExpress = await getUpdatedRE(usedExpress, todayMigrationsE, todayExpressNames, 'E', nowDate);
        createMessageRE(newExpress, 'E', messageSend);
        
        messageSend = CONFIG.TG_MESSAGE_SEND;


    } catch (error) {
        console.log("[Main] -> Error");
        console.error(error);
        sendMessageTG(msgError(error, `runParse`), CONFIG.TG_CHAT_DEBUG);
    } finally {
        console.log('All Complete');
        sendMessageTG(['All%20Complete'], CONFIG.TG_CHAT_DEBUG);
    }
};

async function checkCookie() {
    console.log('[Auth] Check has cookie: ', authData.hasOwnProperty('sbs_session') && authData.hasOwnProperty('XSRF_TOKEN'));
    if(authData.hasOwnProperty('sbs_session') && authData.hasOwnProperty('XSRF_TOKEN')) {
        let status = !((authData.expiry - Date.now()) >= 0);
        console.log('[Auth] Check cookie expiration Date: ', status );
        if ( status ){
            console.log('[Auth] Get cookie process start');
            await login();
            
            console.log('[Auth] Done');
        } else {
            console.log('[Auth] Cookie Good');
        }
    } else { 
        console.log('[Auth] Get cookie process start');
        await login();
        console.log('[Auth] Done');
    }
}

//Получаем текущую дату и фоматируем ее в yyyy-mm-dd
function getDate() {
    try {
        let today = new Date();
        let dd = today.getDate();
        let mm = today.getMonth() + 1;
        let yyyy = today.getFullYear();
        dd = dd < 10 ? `0${dd}` : dd;
        mm = mm < 10 ? `0${mm}` : mm;
        let nowDate = yyyy + "-" + mm + "-" + dd;
        console.log("Today is: " + nowDate);
        return nowDate;
    } catch (error) {
        console.error(error);
        sendMessageTG(msgError(error, `getDate`), CONFIG.TG_CHAT_DEBUG);
    }
};

async function getFileData(fileName) {
    try {
        await fs.access(fileName);
        let fileData = await JSON.parse(await fs.readFile(fileName, 'utf8'));
        if (fileData === undefined) {
            messageSend = false;
            sendMessageTG("sendMessageOff", CONFIG.TG_CHAT_DEBUG);
        };
        console.log(`[Read Old Save Data] -> File ${fileName} Read Good =)`);
        return fileData;
    } catch (error) {
        console.log(`[Read Old Save Data] -> Error Read File ${fileName}. Using empty data.`);
        messageSend = false;
        sendMessageTG(msgError(null, `Creating empty file ${fileName}`), CONFIG.TG_CHAT_DEBUG);
        return fileData = {}
    }
};

async function writeDataRE(text, nowDate, type) {
    try {
        await fs.writeFile(`./updates_data/${type}${nowDate}.json`, JSON.stringify(text));
        console.log('[Save Data] -> Done');
    } catch (error) {
        console.log('[Save Data] -> Error: ');
        console.error(error);
        sendMessageTG(msgError(error, "writeDataRE"), CONFIG.TG_CHAT_DEBUG);
    }
}

async function writeData(text) {
    try {
        await fs.writeFile(CONFIG.PATH_FILE_OLD_DATA, JSON.stringify(text));
        console.log('[Save Data] -> Done');
    } catch (error) {
        console.log('[Save Data] -> Error: ');
        console.error(error);
        sendMessageTG(msgError(error, "writeData"), CONFIG.TG_CHAT_DEBUG);
    }
}

async function getUpdateData(nowDate, type) {
    try {
        await fs.access(`./updates_data/${type}${nowDate}.json`);
        return data = await getFileData(`./updates_data/${type}${nowDate}.json`)
    } catch (error) {
        messageSend = false;
        console.log(`[Read ${type} Data] -> File used release not found. Will be using empty data.`);
        sendMessageTG(msgError(null, `Create empty file ./updates_data/${type}${nowDate}.json`), CONFIG.TG_CHAT_DEBUG);
        return data = { updates: {}, videorelease_id: {} };
    }
}

//Login
async function login() {
    try {
        console.log('[Login] -> Start');

        let initResponse = await getApiData(CONFIG.RB_LOGIN_LINK, true);
        setAuthData(initResponse);

        let authResponse = await getApiData(CONFIG.RB_API_LOGIN_LINK, true, "json", "POST", `{"password":"${CONFIG.RB_AUTH_PASSWORD}","user_login":"${CONFIG.RB_AUTH_LOGIN}"}`);
        setAuthData(authResponse);

        console.log('[Login] -> Complete');
            
    } catch (error) {
        console.log("[Login] -> Error");
        console.error(error);
        sendMessageTG(msgError(error, "login"), CONFIG.TG_CHAT_DEBUG);
    }
}

function setAuthData(response) {
    let cookie = response.headers.get('set-cookie');
    let XSRF_TOKEN = cookie.match(/(?:(?:^|.*;\s*)XSRF-TOKEN\s*\=\s*([^;]*).*$)|^.*$/, "$1")[1];
    let sbs_session = cookie.match(/(?:(?:^|.*,\s*)sbs_session\s*\=\s*([^;]*).*$)|^.*$/, "$1")[1];
    let expiry = cookie.match(/(?:(?:^|.*;\s*)expires\s*\=\s*([^;]*).*$)|^.*$/)[1];
    authData = {
            cookie: decodeURIComponent(cookie),
            XSRF_TOKEN: decodeURIComponent(XSRF_TOKEN),
            expiry: Date.parse(expiry),
            sbs_session: decodeURIComponent(sbs_session)
    }            
    return authData;
}

async function getApiData(link, returnResponse = false, typeReturn, method = "GET", body = null) {
    try {
        let response = await fetch(link, { 
            headers: {
                "accept": "*/*",
                "content-type": "application/json;charset=UTF-8",
                "x-xsrf-token": `${authData.XSRF_TOKEN}`,
                "cookie": `XSRF-TOKEN=${authData.XSRF_TOKEN}; sbs_session=${authData.sbs_session}`
            },
            method: method,
            body: body
        });
        console.log(`[Get Api Data] -> Requset to ${link} ${response.status}`)
        if (response.ok) {
            let data;
            if (returnResponse) { return response };
            if (typeReturn === 'json') { data = await response.json() };
            if (typeReturn === 'text') { data = await response.text() };
            return data;
        } else {
            console.log(`[Get Api Data] -> Bad response from URL: ${link}  Status: ${response.status}`);
        }
    } catch (error) {
        console.log('Error get data ', error);
        return error;
    }
}

//List courses
async function listCourses() {

    try {
        console.log('[List Courses] -> Start');
        let coursesData = [];
        let siteData = await getApiData(CONFIG.RB_COURSES_LINK + '&grid-1[page]=1', false, 'text');
        let document  = (new JSDOM(siteData)).window.document;
        let coursesTable = document.querySelector('table.table');
        function convertData(table){
            for (let i = 1; i < table.rows.length; i++) {
                if ((table.rows[i].cells[0].children[0].textContent.indexOf("Основной курс для Видеорелизов") !== 0) && 
                    (table.rows[i].cells[0].children[0].textContent.indexOf("Основной курс для Экспресс-Обучения") !== 0)) {
                    let cells_0 =   table.rows[i].cells[0].children[0];
                    let cells_1 =   table.rows[i].cells[1].textContent;
                    let course_id = table.rows[i].cells[2].querySelector('a').pathname.replace(/\D+/g, "");

                    coursesData.push( {
                        name: cells_0.textContent,
                        id:   cells_1.substring( cells_1.lastIndexOf("/"), cells_1.length-5 ),
                        idLink: `https://rb.sberbank-school.ru/jsapi/backend/courses/${course_id}/migrations`,
                        idCourse: course_id
                    })
                }
            }
        }
        convertData(coursesTable);
        let quantityCourses = document.querySelector('small').textContent.match(/\d*$/)[0];
        for(let b=2; b <= Math.ceil(quantityCourses/100); b++){
            let siteData = await getApiData(CONFIG.RB_COURSES_LINK + `&grid-1[page]=${b}`, false, 'text');
            let document  = (new JSDOM(siteData)).window.document;
            let coursesTable = document.querySelector('table.table');
            convertData(coursesTable);
        }

        console.log('[List Courses] -> Complete, Total: ' + coursesData.length);
        return coursesData;
    } catch (error) {
        console.log("[List Courses] -> Error");
        console.error(error);
        sendMessageTG(msgError(error, "listCourses"), CONFIG.TG_CHAT_DEBUG);
    }
}


async function parseSiteData(siteData) {
    try {
        console.log("[Parse] -> Start"); 
                 
        var fn = async function delay(elem) {
            let data = await getApiData(elem.idLink, false, 'json');
            if (data.data.length !== 0) {
                elem.id_update = data.data[0].id;
                elem.date_update = data.data[0].attributes.updated_at;
            }
        }
        
        let actions = siteData.map(fn);
        await Promise.all(actions);
        console.log("[Parse] -> Done");
        return siteData;
    } catch (error) {
        console.log("[Parse] -> Error");
        console.error(error);
        sendMessageTG(msgError(error, "parseSiteData"), CONFIG.TG_CHAT_DEBUG);
        return error;
    }
}


async function getDataRE(linkNames, type, what) {
    try {
        //console.log(`[Parse ${type} ${what}] -> Start`);
        console.log(`[Parse ${type} ${what}] -> URL: ${linkNames}`);
        let listNames = [];
        listNames = await getApiData(linkNames, false, 'json');
        console.log(`[Parse ${type} ${what}] -> Count Release: ${listNames.data.length}`);
        //console.log(`[Parse ${type} ${what}] -> Done`);
        return listNames;
    } catch (error) {
        console.log(`[Parse ${type} ${what}] -> Error`);
        console.error(error);
        sendMessageTG(msgError(error, `getNamesRE`), CONFIG.TG_CHAT_DEBUG);
    }
}

async function getUpdatedRE(usedRE, allTodayUpdates, listAllNames, type, nowDate) {
    try {
        let typeCourse = (type === 'R') ? 'Обновлена траектория Видеорелизов' : 'Обновлена траектория Экспресс обучения';
        let newReleases = {};
        for (let i = 0; i < allTodayUpdates.data.length; i++) {
            if (allTodayUpdates.data[i].attributes.crated_at.indexOf(nowDate) === -1) { continue };
            if (usedRE.updates.hasOwnProperty(allTodayUpdates.data[i].id)) {
                continue;
            } else {
                usedRE.updates[allTodayUpdates.data[i].id] = {
                    videorelease_id: null,
                    id_update: allTodayUpdates.data[i].id,
                    name: typeCourse,
                    crated_at: allTodayUpdates.data[i].attributes.crated_at
                };
                newReleases[allTodayUpdates.data[i].id] = {
                    videorelease_id: null,
                    id_update: allTodayUpdates.data[i].id,
                    name: typeCourse,
                    crated_at: allTodayUpdates.data[i].attributes.crated_at
                };

                for (let j = 0; j < listAllNames.data.length; j++) {
                    if (listAllNames.data[j].created_at.indexOf(nowDate)  === -1) { continue };
                    if (usedRE.videorelease_id.hasOwnProperty(listAllNames.data[j].id)) {
                        continue;
                    } else {
                        usedRE.updates[allTodayUpdates.data[i].id] = {
                            videorelease_id: listAllNames.data[j].id,
                            name: listAllNames.data[j].name,
                            crated_at: allTodayUpdates.data[i].attributes.crated_at
                        };
                        newReleases[allTodayUpdates.data[i].id] = {
                            videorelease_id: listAllNames.data[j].id,
                            name: listAllNames.data[j].name,
                            crated_at: allTodayUpdates.data[i].attributes.crated_at
                        };
                        usedRE.videorelease_id[listAllNames.data[j].id] = { id_update: allTodayUpdates.data[i].id };
                        break;
                    }
                }
            }
        }
        await writeDataRE(usedRE, nowDate, type);
        console.log(`[Get Upd ${type}] -> Done`);
        return newReleases;
    } catch (error) {
        console.log(`[Get Upd ${type}] -> Error`);
        console.error(error);
        sendMessageTG(msgError(error, "getUpdatedRelease"), CONFIG.TG_CHAT_DEBUG);
    }
}

function compareData(siteData, oldSiteData) {
    try {
        console.log('[Compare] -> Start');
        let newSiteData = [];
        if(siteData.length === oldSiteData.length) {
            for (let a = 0; a < siteData.length; a++) {
                try {
                    if (oldSiteData[a].id === siteData[a].id) {
                        console.log(`[Compare] -> ${a}) id: ${oldSiteData[a].idCourse}/${siteData[a].idCourse}  | Version: ${oldSiteData[a].id_update}/${siteData[a].id_update}`);
                        if (oldSiteData[a].id_update !== siteData[a].id_update) {
                            newSiteData.push(siteData[a]);
                        }
                    }
                } catch (error) {
                    console.log('[Compare] -> Name Not Found');
                }
            }
        } else {
            console.log('[Compare] -> Add new course');
            messageSend = false;
            sendMessageTG([`Add%20new%20course%20Total ${siteData.length}`], CONFIG.TG_CHAT_DEBUG);
            return siteData;
        }
        console.log('[Compare] -> Done');
        return newSiteData;
    } catch (error) {
        console.log("[Compare] -> Error");
        console.error(error);
        sendMessageTG(msgError(error, "compareData"), CONFIG.TG_CHAT_DEBUG);
    }
}

function createMessageCourses(newSiteData, send) {
    try {
        console.log("[Create Message] -> Start");
        let msg = [];
        if (send) {
            for (let h = 0; h < newSiteData.length; h++) {
                msg[h] = `%23${newSiteData[h].id.slice(1)}` + encodeURI(`\n${newSiteData[h].name}\n`) + "%23update " +encodeURI(` ${newSiteData[h].date_update}`);
            }
            sendMessageTG(msg, CONFIG.TG_CHAT_SUPPORT);
            sendMessageTG(msg, CONFIG.TG_CHAT_RBHELP);

            if(newSiteData.length > 0){
                sendMessageTG([`New%20courses%20 ${newSiteData.length}`], CONFIG.TG_CHAT_DEBUG);
            }
            console.log(`[Create Message] -> Done. Count: ${newSiteData.length}`);
        }
        messageSend = true;
        return msg;
    } catch (error) {
        console.log("[Create Message] -> Error");
        console.error(error);
        sendMessageTG(msgError(error, "createMessageCourses"), CONFIG.TG_CHAT_DEBUG);
    }
}

function createMessageRE(newReleases, type, send) {
    try {

        let typeCourse = (type === 'R') ? 'rb_videorelease' : 'rb_express_education';

        //console.log(`[Create Message ${type}] -> Start`);
        let msg = [];

        if (send) {
            let i = 0;
            for (let key in newReleases) {
                msg[i++] = `%23${typeCourse}` + encodeURI(`\n${newReleases[key].name}\n`) + "%23update " +encodeURI(` ${newReleases[key].crated_at}`);
            }
//TODO Запилить функцию по отправке сообщений на несколько чатов, чтоб не городить эти функции
            sendMessageTG(msg, CONFIG.TG_CHAT_SUPPORT);
            sendMessageTG(msg, CONFIG.TG_CHAT_RBHELP);

            if(msg.length > 0){
                sendMessageTG([`New%20${type}%20 ${msg.length}`], CONFIG.TG_CHAT_DEBUG);
            }

            console.log(`[Create Message ${type}] -> Done. Count: ${msg.length}`);
        }
        //messageSend = true;
        return msg;
    } catch (error) {
        console.log(`[Create Message ${type}] -> Error`);
        console.error(error);
        sendMessageTG(msgError(error, "createMessageRE"), CONFIG.TG_CHAT_DEBUG);
    }
}

function sendMessageTG(message, chat) {
    //console.log("[Send Message] -> Start");
    try {
        let message_string = "";
        message.forEach( el => {
            message_string = `${message_string}\n\n${el}`;
        });
        http.post(`https://api.telegram.org/bot${CONFIG.TG_TOKEN}/sendMessage?chat_id=${chat}&parse_mode=html&text=${message_string}`);


        // for (let i = 0; i < message.length; i++) {
        //    http.post(`https://api.telegram.org/bot${CONFIG.TG_TOKEN}/sendMessage?chat_id=${chat}&parse_mode=html&text=${message[i]}`);
        // }

        //console.log("[Send Message] -> Done");
    } catch (error) {
        console.log("[Send Message] -> Error");
        console.error(error);
        //sendMessageTG(msgError(error, "sendMessageTG"), CONFIG.TG_CHAT_DEBUG);
    }
}

function msgError(e, f) {
    let msg = ["%23error" + encodeURI(`\nfunc: ${f}\nError text: ${e}`)];
    //console.log(msg);
    return msg;
}
async function makeUpdateFolder() {
    try {
        await fs.mkdir("./updates_data/");
        console.log("Update folder create");
    } catch (error) {
        console.log("Update folder find");
    }
}

runParse();
setInterval(runParse, CONFIG.INTERVAL);
