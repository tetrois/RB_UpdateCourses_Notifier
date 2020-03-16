const Nightmare = require('nightmare');	
const fs = require('fs');


(async ()=>{
let nightmare; 
try {
    console.log('Running...');
	nightmare = Nightmare({ show:false }); //openDevTools: { mode: 'detach' },
	await nightmare
        .goto('https://rb.sberbank-school.ru/')
        .insert('input.form__input.form__input--spaceright[name=user_login]','rb-support')
        .insert('input.form__input.form__input--spaceright[name=password]','GhbdtnKjifhbrb123')
        .click('button.button')
        .wait(3000)
        .goto('https://rb.sberbank-school.ru/admin/courses?grid-1%5Bsort%5D%5Bname%5D=asc&grid-1%5Bper-page%5D=100')
    console.log('Autorization complete');
	let siteData = await nightmare.evaluate(function () {
        let mainTableStat = document.querySelector('table.table')
        //console.log(mainTableStat);
        var arrObjects = [];
        for (let i=1; i<10; i++) { //mainTableStat.rows.length
            arrObjects[i] = {
                name:       mainTableStat.rows[i].cells[0].innerText,
                id:         mainTableStat.rows[i].cells[1].innerText,
                idLink:     'https://rb.sberbank-school.ru/jsapi/backend/courses/' + +mainTableStat.rows[i].cells[2].querySelector('a').pathname.replace(/\D+/g,"") + '/migrations'
            }
        }
    	return arrObjects;
    });
    console.log("Количество курсов: " + siteData.length);

    for(let i=1; i<siteData.length; i++) { //siteData.length
        console.log("Site URL: " + siteData[i].idLink);
        await nightmare.goto(siteData[i].idLink).wait(1000)
        let dateUpdate2 = await nightmare.evaluate(function () {
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
        Object.assign( siteData[i], dateUpdate2);

        console.log(dateUpdate2);
    }
    //console(dateUpdate2);

      
    console.log(JSON.stringify(siteData));
    //Save data update in File
    fs.writeFile("test.txt", JSON.stringify(siteData), function(err) {
        if (err) {
            console.log(err);
        }
    });

    //Read Save Data from file
    var obj;
    fs.readFile('test.txt', 'utf8', function (err, data) {
    if (err) throw err;
        obj = JSON.parse(data);
        console.log(obj);
    });

	// последующая работа с данными
} catch (error) {
	console.error(error);
	throw error;
} finally {
	await nightmare.end();
}
})();
