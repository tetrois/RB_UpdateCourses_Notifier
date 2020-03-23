// apt-get -y --force-yes install make unzip g++ libssl-dev git xvfb x11-xkb-utils xfonts-100dpi xfonts-75dpi xfonts-scalable xfonts-cyrillic x11-apps clang libdbus-1-dev libgtk2.0-dev libnotify-dev libgnome-keyring-dev libgconf2-dev libasound2-dev libcap-dev libcups2-dev libxtst-dev libxss1 libnss3-dev gcc-multilib g++-multilib
// Запускать на серваке с помощью команды xvfb-run node --harmony index.js
//https://api.telegram.org/bot893111665:AAH8ITkQgb36--trJYEdtua2J7cp6ncowI8/getUpdates


const Nightmare = require('nightmare');
const fs = require('fs');
const http = require('request');
const config = require('./config.json');


async function runParse() {
    let nightmare;
    try {
        console.log('Running...');
        let oldSiteData = {};
        fs.readFile(config.file.oldData, 'utf8', function (err, data) {

            console.log('[Read Old Save Data] -> Start');
            if (err) {
                console.log('[Read Old Save Data] -> Error =(');
                console.log(err);
            } else {
                oldSiteData = JSON.parse(data);
                console.log('[Read Old Save Data] -> File Read Good =)');
            }
        });


        console.log('[Login] -> Start');
        nightmare = Nightmare({ show: false }); //openDevTools: { mode: 'detach' },
        await nightmare
            .goto('https://rb.sberbank-school.ru/')
            .insert('input.form__input.form__input--spaceright[name=user_login]', config.rb.login)
            .insert('input.form__input.form__input--spaceright[name=password]', config.rb.password)
            .click('button.button')
            .wait(3000)
            .goto('https://rb.sberbank-school.ru/admin/courses?grid-1%5Bsort%5D%5Bname%5D=asc&grid-1%5Bper-page%5D=100')
        console.log('[Login] -> Complete');
        console.log('[List Courses] -> Start');
        let siteData = await nightmare.evaluate(function () {
            let mainTableStat = document.querySelector('table.table')
            var arrObjects = [];
            for (let i = 1; i < mainTableStat.rows.length; i++) { //mainTableStat.rows.length
                arrObjects[i] = {
                    name: mainTableStat.rows[i].cells[0].innerText,
                    id: mainTableStat.rows[i].cells[1].innerText.substring(mainTableStat.rows[i].cells[1].innerText.indexOf("/", 28)),
                    idLink: 'https://rb.sberbank-school.ru/jsapi/backend/courses/' + +mainTableStat.rows[i].cells[2].querySelector('a').pathname.replace(/\D+/g, "") + '/migrations'
                }
            }
            return arrObjects;
        });
        console.log(siteData[3].id);
        console.log('[List Courses] -> Complete, Total: ' + siteData.length);

        for (let i = 1; i < siteData.length; i++) { //siteData.length
            console.log("[Parse] -> URL: " + siteData[i].idLink);
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


        console.log('[Compare] -> Start');
        let newSiteData = [];
        for (let a = 0; a < siteData.length; a++) {
            try {
                console.log("[Compare] -> " + a + ') 1: ' + oldSiteData[a].name + '  | Old version: ' + oldSiteData[a].id_update);
                console.log("[Compare] -> " + a + ') 2: ' + siteData[a].name + '  | New version: ' + siteData[a].id_update);
                if (oldSiteData[a].id_update !== siteData[a].id_update) {
                    newSiteData.push(siteData[a]);
                }
            } catch (error){
                console.log('[Compare] -> Name Not Found');
            }
        }

        let msg = [];
        for (let h = 0; h < newSiteData.length; h++) {
            msg[h] = encodeURI('#update \n id: ' + newSiteData[h].id + "\n" + "name: " + newSiteData[h].name + "\n" + "Date update: " + newSiteData[h].date_update);
        }

        //Save data update in File
        console.log('[Save Data] -> Start');
        fs.writeFile(config.file.oldData, JSON.stringify(siteData), function (err) {
            if (err) {
                console.log('[Save Data] -> Error: ' + err);
            }
        });
        console.log('[Save Data] -> Done');

        if (msg.length !== 0) {
            for (let j = 0; j < msg.length; j++){
                console.log(msg[j]);
                http.post(`https://api.telegram.org/bot${config.telegram.token}/sendMessage?chat_id=${config.telegram.chat}&parse_mode=html&text=${msg[j]}`);
                console.log("Have Update")
            }
        } else {
            console.log("No Updates");
            http.post(`https://api.telegram.org/bot${config.telegram.token}/sendMessage?chat_id=${config.telegram.debugChat}&parse_mode=html&text=NoUpdates`);

        }

        // последующая работа с данными
    } catch (error) {
        http.post(`https://api.telegram.org/bot${config.telegram.token}/sendMessage?chat_id=${config.telegram.debugChat}&parse_mode=html&text=Error`);
        console.error(error);
        throw error;
    } finally {
        await nightmare.end();
        http.post(`https://api.telegram.org/bot${config.telegram.token}/sendMessage?chat_id=${config.telegram.debugChat}&parse_mode=html&text=AllComplete`);
        console.log('All Complete');
    }
};
runParse();
setInterval(runParse, 1800000);
