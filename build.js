// Сборка одностраничной версии для хостинга: node build.js → dist/index.html
// Стили и данные встраиваются в страницу, d3 и topojson грузятся с cdnjs.
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');

const scripts = ['js/world.js', 'js/data-countries.js', 'js/data-orgs.js', 'js/data-gov.js', 'js/data-straits.js', 'js/data-quiz.js', 'js/data-en.js', 'js/data-quiz-en.js', 'js/app.js'];
for (const f of scripts) if (/<\/script/i.test(read(f))) throw new Error(`${f} содержит </script>`);

const html = `<title>ГеоТренажёр</title>
<meta name="theme-color" content="#1f6fd1">
<style>
${read('css/style.css')}
</style>
<div id="app"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js"></script>
${scripts.map(f => `<script>\n${read(f)}\n</script>`).join('\n')}
`;
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/index.html'), html);
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' КБ');
