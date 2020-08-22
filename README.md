# RB_UpdateCourses_Notifier

Парсер данных с сайта и отправка их в телеграм через бота.

Запускать в фоне пока так: nohup node app.js> output.log &

npm i phantomjs-prebuilt
npm i node-horseman
npm i fs
npm i request
npm i node-fetch
npm i jsdom


1) Проверяет наличие cookie. Если их нет или они просрочены то идет делать новые в login();
2) Парсит список курсов с config.rb.coursesListLink
3) Парсит инфу у каждого курса из пункта 2. Дата обновы берется из migration.
4) Сравнивает эти данные с сохраненными ранее. Если есть различия то отправляет сообщение в телегу. 
