const Nightmare = require('nightmare');	
const fs = require('fs');


(async ()=>{
let nightmare; 
try {
    console.log('Running...');

    console.log('Read old stat data');
    let oldSiteData = {};
    fs.readFile('./test.txt', 'utf8', function (err, data) {
        
        console.log('[Read Old Save Data] -> Start');
        if(err){
            console.log('[Read Old Save Data] -> Error =(');
            console.log(err);
        } else {
        
        //console.log("123: " + data);
        oldSiteData = JSON.parse(data);
        //console.log(oldSiteData[1].id_update);
        console.log('[Read Old Save Data] -> File Read Good =)');
        }
    });
    //console.log(oldSiteData);

    
    console.log('[Login] -> Start');
	nightmare = Nightmare({ show:false }); //openDevTools: { mode: 'detach' },
	await nightmare
        .goto('https://rb.sberbank-school.ru/')
        .insert('input.form__input.form__input--spaceright[name=user_login]','rb-support')
        .insert('input.form__input.form__input--spaceright[name=password]','GhbdtnKjifhbrb123')
        .click('button.button')
        .wait(3000)
        .goto('https://rb.sberbank-school.ru/admin/courses?grid-1%5Bsort%5D%5Bname%5D=asc&grid-1%5Bper-page%5D=100')
    console.log('[Login] -> Complete');
    console.log('[List Courses] -> Start');
	let siteData = await nightmare.evaluate(function () {
        let mainTableStat = document.querySelector('table.table')
        //console.log(mainTableStat);
        var arrObjects = [];
        for (let i=1; i<mainTableStat.rows.length; i++) { //mainTableStat.rows.length
            arrObjects[i] = {
                name:       mainTableStat.rows[i].cells[0].innerText,
                id:         mainTableStat.rows[i].cells[1].innerText,
                idLink:     'https://rb.sberbank-school.ru/jsapi/backend/courses/' + +mainTableStat.rows[i].cells[2].querySelector('a').pathname.replace(/\D+/g,"") + '/migrations'
            }
        }
    	return arrObjects;
    });
    console.log('[List Courses] -> Complete, Total: ' + siteData.length);

    for(let i=1; i<siteData.length; i++) { //siteData.length
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
        //dateUpdate2.hasOwnProperty('data') ? console.log('[Parse] -> Good') : console.log('[Parse] -> Bad');
        Object.assign(siteData[i], dateUpdate2);
        

        //console.log(dateUpdate2);
    }
    console.log("[Parse] -> Done");
    //console(dateUpdate2);


    console.log('[Compare] -> Start');
    let newSiteData = [];
    for (let a = 0; a<siteData.length; a++) {
        try {
        console.log("[Compare] -> " + a +') 1: ' + oldSiteData[a].name  + '  | Old version: ' +oldSiteData[a].id_update);
        console.log("[Compare] -> " + a +') 2: ' + siteData[a].name  + '  | New version: ' +siteData[a].id_update);
        } catch {
            console.log('[Compare] -> Name Not Found');
        }
    }

    console.log(newSiteData); //Передать в телегу (список обновленных курсов)




      
    //console.log(JSON.stringify(siteData));
    //Save data update in File
    console.log('[Save Data] -> Start');
    fs.writeFile("test.txt", JSON.stringify(siteData), function(err) {
        if (err) {
            console.log('[Save Data] -> Error: '+ err);
        }
    });
    console.log('[Save Data] -> Done');

	// последующая работа с данными
} catch (error) {
	console.error(error);
	throw error;
} finally {
    await nightmare.end();
    console.log('All Complete');
}
})();
