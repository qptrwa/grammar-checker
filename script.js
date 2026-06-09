const textInput = document.getElementById('textInput');
const checkBtn = document.getElementById('checkBtn');
const clearBtn = document.getElementById('clearBtn');
const copyInputBtn = document.getElementById('copyInputBtn');
const themeToggle = document.getElementById('themeToggle');
const results = document.getElementById('results');
const suggestionsList = document.getElementById('suggestionsList');
const loading = document.getElementById('loading');
const languageSelect = document.getElementById('languageSelect');
const autoCheck = document.getElementById('autoCheck');
const wordCount = document.getElementById('wordCount');
const charCount = document.getElementById('charCount');
const sentenceCount = document.getElementById('sentenceCount');
const readTime = document.getElementById('readTime');
const vocabScore = document.getElementById('vocabScore');
const readabilityScore = document.getElementById('readabilityScore');

const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'if', 'because', 'as', 'until', 'while',
    'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
    'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now',
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', "you're", "you've", "you'll", "you'd", 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', "she's", 'her', 'hers', 'herself', 'it', "it's", 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', "that'll", 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing'
]);

let currentMatches = []; 
let debounceTimer;

function calculateVocabScore(text) {
    const words = text.toLowerCase().match(/\b(\w+)\b/g) || [];
    if (words.length === 0) return 0;
    const uniqueWords = new Set(words).size;
    return Math.round((uniqueWords / words.length) * 100);
}

async function getVocabImprovements(text) {
    const words = text.toLowerCase().match(/\b(\w+)\b/g) || [];
    const wordCounts = {};
    words.forEach(w => {
        if (!STOP_WORDS.has(w) && w.length > 2) {
            wordCounts[w] = (wordCounts[w] || 0) + 1;
        }
    });

    const repeatedWords = Object.entries(wordCounts)
        .filter(([word, count]) => count > 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([word]) => word);

    const vocabMatches = [];
    for (const word of repeatedWords) {
        try {
            const response = await fetch(`https://api.datamuse.com/words?rel_syn=${word}`);
            const data = await response.json();
            if (data && data.length > 0) {
                const replacements = data.slice(0, 5).map(item => ({ value: item.word }));

                const regex = new RegExp(`\\b${word}\\b`, 'gi');
                let match;
                while ((match = regex.exec(text)) !== null) {
                    vocabMatches.push({
                        rule: {
                            id: 'VOCAB_REPETITION',
                            issueType: 'vocabulary',
                            description: 'Vocabulary Repetition',
                            category: { id: 'VOCABULARY', name: 'Vocabulary' }
                        },
                        message: `The word "${word}" is repeated. Consider using a synonym to improve variety.`,
                        replacements: replacements,
                        offset: match.index,
                        length: word.length,
                        chosenReplacement: null,
                        context: {
                            text: text.substring(Math.max(0, match.index - 20), Math.min(text.length, match.index + word.length + 20)),
                            offset: Math.min(match.index, 20),
                            length: word.length
                        }
                    });
                }
            }
        } catch (e) {
            console.error('Synonym fetch failed', e);
        }
    }
    return vocabMatches;
}

// Theme Toggle
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    themeToggle.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
});

textInput.addEventListener('input', () => {
    updateStats();
    if (autoCheck.checked) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            checkGrammar();
        }, 1500);
    }
});

function updateStats() {
    const text = textInput.value;
    const words = text.toLowerCase().match(/\b(\w+)\b/g) || [];
    wordCount.textContent = words.length;
    charCount.textContent = text.length;
    const sentences = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);
    sentenceCount.textContent = sentences.length;
    const minutes = Math.ceil(words.length / 200);
    readTime.textContent = `${minutes} min`;

    if (words.length > 0) {
        const score = calculateVocabScore(text);
        vocabScore.textContent = `${score}%`;

        // Visual feedback for low vocabulary
        if (score < 90) {
            vocabScore.parentElement.classList.add('stat-card-warning');
        } else {
            vocabScore.parentElement.classList.remove('stat-card-warning');
        }

        // Readability Score (Flesch Reading Ease)
        const sents = sentences.length || 1;
        const totalSyllables = words.reduce((acc, word) => acc + countSyllables(word), 0);
        const fscore = 206.835 - 1.015 * (words.length / sents) - 84.6 * (totalSyllables / words.length);
        readabilityScore.textContent = Math.max(0, Math.min(100, Math.round(fscore)));
    } else {
        vocabScore.textContent = '0%';
        readabilityScore.textContent = '0';
    }
}

function countSyllables(word) {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const syllables = word.match(/[aeiouy]{1,2}/g);
    return syllables ? syllables.length : 1;
}

clearBtn.addEventListener('click', () => {
    textInput.value = '';
    results.style.display = 'none';
    window.speechSynthesis.cancel(); // Safety stop
    updateStats();
});

copyInputBtn.addEventListener('click', () => {
    if (!textInput.value) return;
    navigator.clipboard.writeText(textInput.value);
    const originalText = copyInputBtn.textContent;
    copyInputBtn.textContent = '✓ Copied!';
    setTimeout(() => copyInputBtn.textContent = originalText, 2000);
});

checkBtn.addEventListener('click', checkGrammar);

async function checkGrammar() {
    const text = textInput.value.trim();
    if (!text) return alert('Please enter some text!');
    
    loading.style.display = 'block';
    results.style.display = 'none';
    window.speechSynthesis.cancel(); // Stop speech if starting new check
    
    try {
        const language = languageSelect.value;
        const response = await fetch('https://api.languagetool.org/v2/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `text=${encodeURIComponent(text)}&language=${language}`
        });
        const data = await response.json();
        
        currentMatches = data.matches.map(match => ({
            ...match,
            chosenReplacement: null
        }));

        // Vocabulary Improvement Logic
        if (language.startsWith('en')) {
            const score = calculateVocabScore(text);
            if (score > 0 && score < 90) {
                const vocabMatches = await getVocabImprovements(text);
                currentMatches = [...currentMatches, ...vocabMatches];
            }
        }
        
        displayResults(text);
    } catch (error) {
        alert('Check failed. Try again later.');
    } finally {
        loading.style.display = 'none';
    }
}

function displayResults(originalText) {
    suggestionsList.innerHTML = '';
    
    if (currentMatches.length === 0) {
        const noErrors = document.createElement('p');
        noErrors.style.color = '#00b894';
        noErrors.style.fontWeight = '600';
        noErrors.textContent = '✓ Looking good! No errors.';
        suggestionsList.appendChild(noErrors);
    } else {
        currentMatches.forEach((match, index) => {
            const suggestionItem = document.createElement('div');
            const type = match.rule.issueType || 'other';
            suggestionItem.className = `suggestion-item ${type}`;

            const typeSpan = document.createElement('span');
            typeSpan.className = 'suggestion-type';
            typeSpan.style.color = '#667eea';
            typeSpan.style.fontWeight = 'bold';
            typeSpan.textContent = (match.rule.issueType || 'suggestion').toUpperCase();
            suggestionItem.appendChild(typeSpan);

            const issuePara = document.createElement('p');
            issuePara.style.margin = '5px 0';
            const issueStrong = document.createElement('strong');
            issueStrong.textContent = 'Issue: ';
            issuePara.appendChild(issueStrong);
            issuePara.appendChild(document.createTextNode(match.message));
            suggestionItem.appendChild(issuePara);
            
            if (match.replacements.length > 0) {
                const chipsDiv = document.createElement('div');
                chipsDiv.className = 'replacement-chips';
                match.replacements.slice(0, 5).forEach((rep, idx) => {
                    const isSelected = (match.chosenReplacement === rep.value) || (!match.chosenReplacement && idx === 0);
                    const chip = document.createElement('span');
                    chip.className = `chip ${isSelected ? 'selected' : ''}`;
                    chip.textContent = rep.value;
                    chip.addEventListener('click', () => selectReplacement(index, rep.value));
                    chipsDiv.appendChild(chip);
                });
                suggestionItem.appendChild(chipsDiv);
            }

            suggestionsList.appendChild(suggestionItem);
        });
        renderCorrectedSection(originalText);
    }
    results.style.display = 'block';
}

function selectReplacement(index, val) {
    currentMatches[index].chosenReplacement = val;
    displayResults(textInput.value);
}

function renderCorrectedSection(originalText) {
    const hasSecondOption = currentMatches.some(m => m.replacements.length > 1);

    const option1Text = applySuggestions(originalText, currentMatches, 0);
    const option2Text = hasSecondOption ? applySuggestions(originalText, currentMatches, 1) : "";

    const correctedSection = document.createElement('div');
    correctedSection.className = 'corrected-section';

    const optionsGrid = document.createElement('div');
    optionsGrid.className = 'options-grid';

    // Option 1
    const opt1Box = document.createElement('div');
    opt1Box.className = 'option-box';
    const opt1Title = document.createElement('h3');
    opt1Title.textContent = '✨ Option 1';
    opt1Box.appendChild(opt1Title);

    const opt1TextDiv = document.createElement('div');
    opt1TextDiv.className = 'finalText';
    opt1TextDiv.style.whiteSpace = 'pre-wrap';
    opt1TextDiv.style.margin = '10px 0';
    opt1TextDiv.style.lineHeight = '1.6';
    opt1TextDiv.style.color = 'var(--text-main)';
    opt1TextDiv.textContent = option1Text;
    opt1Box.appendChild(opt1TextDiv);

    const opt1Actions = document.createElement('div');
    opt1Actions.className = 'action-buttons';
    const copyBtn1 = document.createElement('button');
    copyBtn1.id = 'copyBtn1';
    copyBtn1.className = 'btn-copy';
    copyBtn1.textContent = '📋 Copy Option 1';
    copyBtn1.addEventListener('click', () => {
        navigator.clipboard.writeText(option1Text);
        copyBtn1.textContent = '✓ Copied!';
        setTimeout(() => copyBtn1.textContent = '📋 Copy Option 1', 2000);
    });
    opt1Actions.appendChild(copyBtn1);
    opt1Box.appendChild(opt1Actions);
    optionsGrid.appendChild(opt1Box);

    // Option 2
    if (hasSecondOption) {
        const opt2Box = document.createElement('div');
        opt2Box.className = 'option-box';
        const opt2Title = document.createElement('h3');
        opt2Title.textContent = '✨ Option 2';
        opt2Box.appendChild(opt2Title);

        const opt2TextDiv = document.createElement('div');
        opt2TextDiv.className = 'finalText';
        opt2TextDiv.style.whiteSpace = 'pre-wrap';
        opt2TextDiv.style.margin = '10px 0';
        opt2TextDiv.style.lineHeight = '1.6';
        opt2TextDiv.style.color = 'var(--text-main)';
        opt2TextDiv.textContent = option2Text;
        opt2Box.appendChild(opt2TextDiv);

        const opt2Actions = document.createElement('div');
        opt2Actions.className = 'action-buttons';
        const copyBtn2 = document.createElement('button');
        copyBtn2.id = 'copyBtn2';
        copyBtn2.className = 'btn-copy';
        copyBtn2.textContent = '📋 Copy Option 2';
        copyBtn2.addEventListener('click', () => {
            navigator.clipboard.writeText(option2Text);
            copyBtn2.textContent = '✓ Copied!';
            setTimeout(() => copyBtn2.textContent = '📋 Copy Option 2', 2000);
        });
        opt2Actions.appendChild(copyBtn2);
        opt2Box.appendChild(opt2Actions);
        optionsGrid.appendChild(opt2Box);
    }

    correctedSection.appendChild(optionsGrid);

    // Secondary Actions
    const secondaryActions = document.createElement('div');
    secondaryActions.className = 'action-buttons secondary-actions';

    const speakBtn = document.createElement('button');
    speakBtn.id = 'speakBtn';
    speakBtn.className = 'btn-speak';
    speakBtn.textContent = '🔊 Read Aloud (Opt 1)';
    speakBtn.addEventListener('click', () => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(option1Text);
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    });
    secondaryActions.appendChild(speakBtn);

    const stopBtn = document.createElement('button');
    stopBtn.id = 'stopBtn';
    stopBtn.className = 'btn-stop';
    stopBtn.textContent = '⏹ Stop';
    stopBtn.addEventListener('click', () => {
        window.speechSynthesis.cancel();
    });
    secondaryActions.appendChild(stopBtn);

    const downloadBtn = document.createElement('button');
    downloadBtn.id = 'downloadBtn';
    downloadBtn.className = 'btn-download';
    downloadBtn.textContent = '💾 Download .txt';
    downloadBtn.addEventListener('click', () => {
        const element = document.createElement('a');
        const content = `OPTION 1:\n${option1Text}\n\n${hasSecondOption ? `OPTION 2:\n${option2Text}\n\n` : ''}SUMMARY:\n${currentMatches.map(m => `${originalText.substring(m.offset, m.offset + m.length)} -> ${m.chosenReplacement || (m.replacements.length > 0 ? m.replacements[0].value : "(removed)")}`).join('\n')}`;
        const file = new Blob([content], {type: 'text/plain'});
        element.href = URL.createObjectURL(file);
        element.download = 'corrected_text.txt';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    });
    secondaryActions.appendChild(downloadBtn);

    correctedSection.appendChild(secondaryActions);

    // Summary
    const summarySection = document.createElement('div');
    summarySection.className = 'summary-section';
    const summaryTitle = document.createElement('h3');
    summaryTitle.textContent = '📝 Fix Summary';
    summarySection.appendChild(summaryTitle);

    const summaryList = document.createElement('ul');
    summaryList.className = 'summary-list';

    currentMatches.forEach(m => {
        const original = originalText.substring(m.offset, m.offset + m.length);
        const corrected = m.chosenReplacement || (m.replacements.length > 0 ? m.replacements[0].value : "(removed)");

        const summaryItem = document.createElement('li');
        summaryItem.className = 'summary-item';

        const originalSpan = document.createElement('span');
        originalSpan.className = 'original-text';
        originalSpan.textContent = original;

        const arrowSpan = document.createElement('span');
        arrowSpan.className = 'arrow';
        arrowSpan.textContent = '→';

        const correctedSpan = document.createElement('span');
        correctedSpan.className = 'corrected-text';
        correctedSpan.textContent = corrected;

        summaryItem.appendChild(originalSpan);
        summaryItem.appendChild(document.createTextNode(' '));
        summaryItem.appendChild(arrowSpan);
        summaryItem.appendChild(document.createTextNode(' '));
        summaryItem.appendChild(correctedSpan);
        summaryList.appendChild(summaryItem);
    });
    summarySection.appendChild(summaryList);
    correctedSection.appendChild(summarySection);

    suggestionsList.appendChild(correctedSection);
}

function applySuggestions(text, matches, replacementIndex = 0) {
    let result = text;
    const sorted = [...matches].sort((a, b) => b.offset - a.offset);
    sorted.forEach(m => {
        let replacement = m.chosenReplacement;

        // If no manual choice, use the replacement at the specified index
        if (replacement === null && m.replacements && m.replacements.length > 0) {
            const idx = (replacementIndex < m.replacements.length) ? replacementIndex : 0;
            replacement = m.replacements[idx].value;
        }

        if (replacement !== null) {
            result = result.substring(0, m.offset) + replacement + result.substring(m.offset + m.length);
        }
    });
    return result;
}

updateStats();
