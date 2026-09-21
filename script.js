let data = [];
let weblioTimer = null;

const searchInput = document.getElementById('searchInput');
const clearButton = document.getElementById('clearButton');
const resultsDiv = document.getElementById('results');
const statusEl = document.getElementById('status');
const weblioFrame = document.getElementById('weblioFrame');

setupEventListeners();
loadData();

async function loadData() {
    setStatus('データを読み込んでいます…');

    try {
        const response = await fetch('data.csv');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const csvText = await response.text();
        data = parseCSV(csvText);

        if (data.length === 0) {
            throw new Error('CSVに有効なデータがありません');
        }

        searchAndDisplayResults(searchInput.value);
    } catch (error) {
        console.error('CSV読み込みエラー:', error);
        data = [];
        resultsDiv.replaceChildren(createMessage('データの読み込みに失敗しました。ページを再読み込みしてください。', 'error'));
        setStatus('読み込みエラー');
    }
}

/**
 * RFC 4180相当の基本的なCSVを解析する。
 * - カンマを含む引用フィールド
 * - フィールド内改行
 * - "" によるダブルクオートのエスケープ
 * - CRLF / LF
 */
function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (inQuotes) {
            if (char === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += char;
            }
            continue;
        }

        if (char === '"') {
            inQuotes = true;
        } else if (char === ',') {
            row.push(field);
            field = '';
        } else if (char === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else if (char !== '\r') {
            field += char;
        }
    }

    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    return rows
        .filter(fields => fields.length >= 2 && (fields[0].trim() || fields[1].trim()))
        .map((fields, index) => ({
            index: index + 1,
            japanese: fields[0].trim(),
            english: fields.slice(1).join(',').trim()
        }));
}

function setupEventListeners() {
    searchInput.addEventListener('input', () => {
        searchAndDisplayResults(searchInput.value);
    });

    clearButton.addEventListener('click', () => {
        searchInput.value = '';
        searchInput.focus();
        searchAndDisplayResults('');
    });

    searchInput.addEventListener('keydown', event => {
        if (event.key === 'Escape' && searchInput.value) {
            searchInput.value = '';
            searchAndDisplayResults('');
        }
    });
}

function normalizeText(value) {
    return value
        .normalize('NFKC')
        .toLocaleLowerCase('ja-JP');
}

function parseQuery(rawQuery) {
    const normalized = normalizeText(rawQuery).trim();
    if (!normalized) return [];

    return normalized
        .split(/\s+or\s+/i)
        .map(group => group.trim().split(/\s+/).filter(Boolean))
        .filter(group => group.length > 0);
}

function searchAndDisplayResults(rawQuery) {
    if (!data.length) return;

    const queryGroups = parseQuery(rawQuery);

    const results = queryGroups.length === 0
        ? data
        : data.filter(item => {
            const haystack = normalizeText(`${item.english}\n${item.japanese}`);
            return queryGroups.some(group =>
                group.every(keyword => haystack.includes(keyword))
            );
        });

    displayResults(results);
    setStatus(
        queryGroups.length === 0
            ? `${results.length}件の例文`
            : `${results.length}件ヒット`
    );
    scheduleWeblio(rawQuery.trim());
}

function displayResults(results) {
    const fragment = document.createDocumentFragment();

    if (results.length === 0) {
        fragment.appendChild(createMessage('結果が見つかりませんでした。', 'empty'));
        resultsDiv.replaceChildren(fragment);
        return;
    }

    for (const item of results) {
        const article = document.createElement('article');
        article.className = 'result-item';

        const japanese = document.createElement('p');
        japanese.className = 'result-japanese';

        const number = document.createElement('span');
        number.className = 'result-number';
        number.textContent = String(item.index);

        japanese.append(number, document.createTextNode(` ${item.japanese}`));

        const english = document.createElement('p');
        english.className = 'result-english';
        english.textContent = item.english;

        article.append(japanese, english);
        fragment.appendChild(article);
    }

    resultsDiv.replaceChildren(fragment);
}

function createMessage(text, type) {
    const p = document.createElement('p');
    p.className = `message message-${type}`;
    p.textContent = text;
    return p;
}

function setStatus(text) {
    statusEl.textContent = text;
}

function scheduleWeblio(keyword) {
    window.clearTimeout(weblioTimer);

    if (!keyword) {
        weblioFrame.replaceChildren();
        return;
    }

    weblioTimer = window.setTimeout(() => {
        const embedUrl = new URL('https://api.weblio.jp/act/quote/v_1_0/e/');
        embedUrl.searchParams.set('q', keyword);
        embedUrl.searchParams.set('type', 'emicro');
        embedUrl.searchParams.set('opul', window.location.href);

        const iframe = document.createElement('iframe');
        iframe.src = embedUrl.toString();
        iframe.title = `Weblio: ${keyword}`;
        iframe.loading = 'lazy';
        iframe.referrerPolicy = 'strict-origin-when-cross-origin';
        weblioFrame.replaceChildren(iframe);
    }, 350);
}
