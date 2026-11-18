(() => {
  "use strict";

  const MAX_FILE_SIZE = 20 * 1024 * 1024;
  const state = {
    file: null,
    action: "concise",
    result: "",
    resultTitle: "",
    resultSource: "demo",
    endpoint: "",
    notesUploaded: 0,
    wordsProcessed: 0,
    materialsCreated: 0,
    toastTimer: null
  };

  const elements = {
    input: document.getElementById("file-input"),
    dropzone: document.getElementById("dropzone"),
    fileCard: document.getElementById("file-card"),
    fileName: document.getElementById("file-name"),
    fileDetails: document.getElementById("file-details"),
    fileType: document.getElementById("file-type-icon"),
    fileStatus: document.getElementById("file-status"),
    uploadError: document.getElementById("upload-error"),
    removeFile: document.getElementById("remove-file"),
    generate: document.getElementById("generate-button"),
    generateLabel: document.getElementById("generate-label"),
    createHint: document.getElementById("create-hint"),
    resultPanel: document.getElementById("result-panel"),
    resultTitle: document.getElementById("result-title"),
    resultMode: document.getElementById("result-mode"),
    resultContent: document.getElementById("result-content"),
    resultMeta: document.getElementById("result-meta"),
    copyButton: document.getElementById("copy-button"),
    downloadButton: document.getElementById("download-button"),
    endpoint: document.getElementById("endpoint-input"),
    saveEndpoint: document.getElementById("save-endpoint"),
    connectionBadge: document.getElementById("connection-badge"),
    aiDescription: document.getElementById("ai-description"),
    connectionMessage: document.getElementById("connection-message"),
    toast: document.getElementById("toast"),
    sidebar: document.getElementById("sidebar"),
    menuToggle: document.getElementById("menu-toggle")
  };

  const actions = {
    concise: { title: "Your quick summary", label: "Quick summary" },
    detailed: { title: "Your detailed summary", label: "Detailed summary" },
    keypoints: { title: "The key points", label: "Key points" },
    questions: { title: "Exam practice", label: "Exam practice questions" },
    flashcards: { title: "Your flashcards", label: "Flashcards" }
  };

  const stopWords = new Set(("a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just more most my nor not of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your process during helps help produced released supports support maintain affect affects drive drives absorbs absorbed convert converts take takes using used uses made make makes").split(" "));
  const wordPattern = /[A-Za-z0-9][A-Za-z0-9'’-]*/g;

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 3000);
  }

  function setUploadError(message) {
    elements.uploadError.textContent = message;
    elements.uploadError.classList.toggle("hidden", !message);
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function countWords(text) {
    return (text.match(wordPattern) || []).length;
  }

  function updateStats() {
    document.getElementById("stat-notes").textContent = String(state.notesUploaded);
    document.getElementById("notes-count").textContent = String(state.notesUploaded);
    document.getElementById("stat-words").textContent = state.wordsProcessed.toLocaleString();
    document.getElementById("stat-materials").textContent = String(state.materialsCreated);
  }

  function setFileStatus(message, loading) {
    elements.fileStatus.innerHTML = "";
    elements.fileStatus.classList.toggle("is-loading", Boolean(loading));
    const dot = document.createElement("span");
    elements.fileStatus.append(dot, document.createTextNode(message));
  }

  function showFileCard(file, loading) {
    elements.fileName.textContent = file.name;
    elements.fileDetails.textContent = `${formatBytes(file.size)} · ${loading ? "Extracting text…" : `${countWords(state.file.text).toLocaleString()} words ready`}`;
    elements.fileType.textContent = file.name.split(".").pop().toUpperCase().slice(0, 4);
    elements.fileCard.classList.remove("hidden");
    elements.dropzone.classList.add("hidden");
    setFileStatus(loading ? "Reading" : "Ready", loading);
  }

  async function extractText(file) {
    const extension = file.name.split(".").pop().toLowerCase();
    if (extension === "txt") return (await file.text()).replace(/\u0000/g, "").trim();

    if (extension === "pdf") {
      if (!window.pdfjsLib) throw new Error("PDF reading library did not load. Check your internet connection and try again.");
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      const documentData = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      const pages = [];
      for (let pageNumber = 1; pageNumber <= documentData.numPages; pageNumber += 1) {
        const page = await documentData.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(content.items.map(item => item.str).join(" "));
      }
      return pages.join("\n\n").trim();
    }

    if (extension === "docx") {
      if (!window.mammoth) throw new Error("DOCX reading library did not load. Check your internet connection and try again.");
      const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return result.value.trim();
    }

    throw new Error("This file type is not supported. Choose a PDF, DOCX or TXT file.");
  }

  async function handleFile(file) {
    if (!file) return;
    setUploadError("");
    elements.resultPanel.classList.add("hidden");
    const extension = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "txt", "docx"].includes(extension)) {
      setUploadError("That file type is not supported. Choose a PDF, DOCX or TXT file.");
      elements.input.value = "";
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError("This file is larger than 20 MB. Please choose a smaller study note.");
      elements.input.value = "";
      return;
    }
    if (file.size === 0) {
      setUploadError("This file is empty. Choose a document that contains study notes.");
      elements.input.value = "";
      return;
    }

    state.file = { name: file.name, size: file.size, text: "" };
    showFileCard(file, true);
    elements.generate.disabled = true;
    elements.createHint.textContent = "Reading your file…";
    try {
      const text = await extractText(file);
      if (!text || countWords(text) === 0) {
        throw new Error("No readable text was found. Scanned PDFs need OCR before they can be used.");
      }
      state.file.text = text;
      state.notesUploaded += 1;
      state.wordsProcessed += countWords(text);
      updateStats();
      elements.fileDetails.textContent = `${formatBytes(file.size)} · ${countWords(text).toLocaleString()} words ready`;
      setFileStatus("Ready", false);
      elements.generate.disabled = false;
      elements.createHint.textContent = `${countWords(text).toLocaleString()} words ready to turn into ${actions[state.action].label.toLowerCase()}.`;
      document.getElementById("flow-create").classList.add("is-done");
      document.getElementById("flow-create").querySelector(".flow-number").textContent = "✓";
    } catch (error) {
      state.file = null;
      elements.fileCard.classList.add("hidden");
      elements.dropzone.classList.remove("hidden");
      elements.generate.disabled = true;
      elements.createHint.textContent = "Upload a file to get started.";
      setUploadError(error instanceof Error ? error.message : "The file could not be read.");
    }
  }

  function clearFile() {
    state.file = null;
    elements.input.value = "";
    elements.fileCard.classList.add("hidden");
    elements.dropzone.classList.remove("hidden");
    elements.resultPanel.classList.add("hidden");
    elements.generate.disabled = true;
    elements.createHint.textContent = "Upload a file to get started.";
    setUploadError("");
  }

  function sentencesFrom(text) {
    return text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 35 && countWords(sentence) > 5);
  }

  function termsFrom(text) {
    const frequencies = new Map();
    for (const word of text.match(wordPattern) || []) {
      const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normalized.length < 4 || stopWords.has(normalized) || /^\d+$/.test(normalized)) continue;
      frequencies.set(normalized, (frequencies.get(normalized) || 0) + 1);
    }
    return frequencies;
  }

  function scoreSentences(sentences, frequencies) {
    return sentences.map((sentence, index) => {
      const words = (sentence.toLowerCase().match(wordPattern) || []).map(word => word.replace(/[^a-z0-9]/g, ""));
      let score = 0;
      const seen = new Set();
      for (const word of words) {
        if (word.length < 4 || stopWords.has(word) || seen.has(word)) continue;
        seen.add(word);
        score += Math.log1p(frequencies.get(word) || 0);
      }
      if (/^(in conclusion|therefore|in summary|overall|importantly|key point)/i.test(sentence)) score += 1.2;
      score /= Math.sqrt(Math.max(1, words.length));
      score += Math.max(0, 0.18 - index * 0.003);
      return { sentence, index, score };
    });
  }

  function selectSentences(text, limit) {
    const sentences = sentencesFrom(text);
    if (!sentences.length) return [text.slice(0, 1400)];
    const frequencies = termsFrom(text);
    return scoreSentences(sentences, frequencies)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .sort((a, b) => a.index - b.index)
      .map(item => item.sentence);
  }

  function keyTermsFor(sentence, frequencies, used) {
    const words = sentence.match(wordPattern) || [];
    const term = words
      .map((word, index) => ({ word, index, score: frequencies.get(word.toLowerCase().replace(/[^a-z0-9]/g, "")) || 0 }))
      .filter(item => item.word.length > 3 && !stopWords.has(item.word.toLowerCase()) && !used.has(item.word.toLowerCase()))
      .sort((a, b) => b.score - a.score || b.word.length - a.word.length)[0];
    if (!term) return undefined;
    const prefix = words[term.index - 1];
    if (prefix && !used.has(prefix.toLowerCase()) && /^(carbon|chemical|green|kinetic|light|potential|solar)$/i.test(prefix)) term.word = `${prefix} ${term.word}`;
    return term;
  }

  function makeDemoResult(action, text) {
    const frequencies = termsFrom(text);
    if (action === "concise" || action === "detailed") {
      const picks = selectSentences(text, action === "concise" ? 3 : 7);
      return picks.join("\n\n");
    }
    if (action === "keypoints") {
      const picks = selectSentences(text, 6);
      return picks.map(sentence => `• ${sentence}`).join("\n\n");
    }
    if (action === "questions") {
      const picks = selectSentences(text, 5);
      const used = new Set();
      const pairs = picks.map((sentence, index) => {
        const term = keyTermsFor(sentence, frequencies, used);
        const keyword = term ? term.word.replace(/[.,!?;:]+$/, "") : `idea ${index + 1}`;
        keyword.toLowerCase().split(/\s+/).forEach(term => used.add(term));
        return `Q${index + 1}. What do the notes say about ${keyword}?\nA. ${sentence}`;
      });
      return pairs.join("\n\n");
    }
    const picks = selectSentences(text, 6);
    const used = new Set();
    const cards = picks.map((sentence, index) => {
      const term = keyTermsFor(sentence, frequencies, used);
      const keyword = term ? term.word.replace(/[.,!?;:]+$/, "") : `Key idea ${index + 1}`;
      keyword.toLowerCase().split(/\s+/).forEach(term => used.add(term));
      return { front: keyword, back: sentence };
    });
    return cards.map((card, index) => `Card ${index + 1} — ${card.front}\n${card.back}`).join("\n\n");
  }

  function renderResult(text, action, source) {
    elements.resultContent.replaceChildren();
    const disclaimer = source === "demo" ? "Demo mode · This is an extractive, local text-processing result, not AI-generated content." : "";
    if (disclaimer) {
      const note = document.createElement("p");
      note.className = "result-disclaimer";
      note.textContent = disclaimer;
      elements.resultContent.append(note);
    }
    if (source === "demo" && action === "keypoints") {
      const list = document.createElement("ul");
      text.split("\n").filter(line => line.startsWith("• ")).forEach(line => {
        const item = document.createElement("li");
        item.textContent = line.slice(2);
        list.append(item);
      });
      elements.resultContent.append(list);
    } else if (source === "demo" && (action === "questions" || action === "flashcards")) {
      const cards = document.createElement("div");
      cards.className = action === "questions" ? "qa-list" : "flashcard-list";
      text.split(/\n\n+/).forEach(block => {
        const lines = block.split("\n");
        if (action === "questions") {
          const question = lines[0].match(/^Q\d+\.\s*(.+)$/);
          if (!question) return;
          const item = document.createElement("article");
          item.className = "qa-item";
          const heading = document.createElement("strong");
          heading.textContent = question[1];
          const answer = document.createElement("p");
          answer.textContent = lines.slice(1).join(" ").replace(/^A\.\s*/, "");
          item.append(heading, answer);
          cards.append(item);
          return;
        }
        const front = lines[0].match(/^Card \d+ — (.+)$/);
        if (!front) return;
        const card = document.createElement("article");
        card.className = "flashcard";
        const heading = document.createElement("strong");
        heading.textContent = `Front · ${front[1]}`;
        const reveal = document.createElement("button");
        reveal.className = "reveal-answer";
        reveal.type = "button";
        reveal.setAttribute("aria-expanded", "false");
        reveal.textContent = "Show answer";
        const answer = document.createElement("p");
        answer.className = "flashcard-answer hidden";
        answer.textContent = lines.slice(1).join(" ");
        reveal.addEventListener("click", () => {
          const isExpanded = reveal.getAttribute("aria-expanded") === "true";
          reveal.setAttribute("aria-expanded", String(!isExpanded));
          reveal.textContent = isExpanded ? "Show answer" : "Hide answer";
          answer.classList.toggle("hidden", isExpanded);
        });
        card.append(heading, reveal, answer);
        cards.append(card);
      });
      elements.resultContent.append(cards);
    } else {
      const content = document.createElement("div");
      content.className = "result-copy";
      content.textContent = text;
      elements.resultContent.append(content);
    }
    elements.resultTitle.textContent = actions[action].title;
    elements.resultMode.textContent = source === "demo" ? "Demo mode" : "Endpoint response";
    elements.resultMode.classList.toggle("endpoint-badge", source !== "demo");
    elements.resultMeta.textContent = source === "demo"
      ? `Extractive result · ${countWords(state.file.text).toLocaleString()} source words · No AI model used`
      : `Response from your configured server endpoint · ${countWords(state.file.text).toLocaleString()} source words`;
    elements.resultPanel.classList.remove("hidden");
    document.getElementById("flow-review").classList.add("is-done");
    document.getElementById("flow-review").querySelector(".flow-number").textContent = "✓";
    elements.resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function readEndpoint() {
    const raw = elements.endpoint.value.trim();
    if (!raw) return "";
    let url;
    try {
      url = new URL(raw, window.location.href);
    } catch {
      throw new Error("Enter a valid server endpoint URL.");
    }
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("The endpoint must use HTTP or HTTPS.");
    if (url.username || url.password) throw new Error("Do not put credentials in the endpoint URL. Keep them on your server.");
    if (/[?&#](?:[^=&#]*(?:key|token|secret|auth)[^=&#]*)=/i.test(raw)) {
      throw new Error("Do not put API keys or credentials in the endpoint URL. Keep them on your server.");
    }
    return url.href;
  }

  async function requestEndpoint(endpoint, action) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ action, text: state.file.text, filename: state.file.name })
    });
    if (!response.ok) throw new Error(`The study endpoint returned HTTP ${response.status}.`);
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error("The study endpoint did not return valid JSON.");
    }
    if (!payload || typeof payload.result !== "string" || !payload.result.trim()) {
      throw new Error("The endpoint response must contain a non-empty result string.");
    }
    return payload.result.trim();
  }

  async function generate() {
    if (!state.file || !state.file.text) {
      showToast("Upload a readable study note first.");
      return;
    }
    elements.generate.disabled = true;
    elements.generateLabel.textContent = "Creating…";
    elements.createHint.textContent = "Working with your study notes…";
    try {
      const endpoint = readEndpoint();
      if (endpoint !== state.endpoint) throw new Error("Save endpoint changes before using them.");
      let result;
      let source;
      if (endpoint) {
        result = await requestEndpoint(endpoint, state.action);
        source = "endpoint";
      } else {
        result = makeDemoResult(state.action, state.file.text);
        source = "demo";
      }
      state.result = result;
      state.resultTitle = actions[state.action].title;
      state.resultSource = source;
      state.materialsCreated += 1;
      updateStats();
      renderResult(result, state.action, source);
      elements.createHint.textContent = source === "demo"
        ? "Created with local extractive text processing (not AI)."
        : "Received a response from your configured server endpoint.";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Study material could not be created.";
      elements.createHint.textContent = message;
      elements.createHint.style.color = "#bd4750";
      showToast(message);
    } finally {
      elements.generate.disabled = !state.file;
      elements.generateLabel.textContent = "Create study material";
    }
  }

  function setAction(action) {
    if (!actions[action]) return;
    state.action = action;
    document.querySelectorAll(".tool-card").forEach(card => {
      const selected = card.dataset.action === action;
      card.classList.toggle("selected", selected);
      card.setAttribute("aria-pressed", String(selected));
    });
    elements.createHint.style.color = "";
    if (state.file) elements.createHint.textContent = `${countWords(state.file.text).toLocaleString()} words ready to turn into ${actions[action].label.toLowerCase()}.`;
  }

  function saveEndpoint() {
    elements.connectionMessage.textContent = "";
    let endpoint;
    try {
      endpoint = readEndpoint();
    } catch (error) {
      elements.connectionMessage.style.color = "#bd4750";
      elements.connectionMessage.textContent = error instanceof Error ? error.message : "Endpoint URL is invalid.";
      return;
    }
    try {
      if (endpoint) localStorage.setItem("studywise-endpoint", endpoint);
      else localStorage.removeItem("studywise-endpoint");
      state.endpoint = endpoint;
      updateConnectionState(endpoint);
      elements.connectionMessage.style.color = "#3f9878";
      elements.connectionMessage.textContent = endpoint
        ? "Endpoint saved. It will be used for the next generation request."
        : "Endpoint removed. Study tools will use demo mode.";
    } catch {
      elements.connectionMessage.style.color = "#bd4750";
      elements.connectionMessage.textContent = "Could not save this setting in browser storage. The endpoint remains available for this page session.";
      state.endpoint = endpoint;
      updateConnectionState(endpoint);
    }
  }

  function updateConnectionState(endpoint) {
    const configured = Boolean(endpoint);
    elements.connectionBadge.textContent = configured ? "Endpoint set" : "Demo mode";
    elements.connectionBadge.classList.toggle("endpoint-badge", configured);
    elements.aiDescription.textContent = configured
      ? "A server endpoint is configured. Responses will come from that service; this app does not verify whether it uses an AI model."
      : "No AI service is connected. Study materials use transparent, local text-processing heuristics—not an AI model.";
  }

  async function copyResult() {
    if (!state.result) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(state.result);
      } else {
        const temp = document.createElement("textarea");
        temp.value = state.result;
        temp.setAttribute("readonly", "");
        temp.style.position = "fixed";
        temp.style.opacity = "0";
        document.body.append(temp);
        temp.select();
        const copied = document.execCommand("copy");
        temp.remove();
        if (!copied) throw new Error("Clipboard access is unavailable in this browser.");
      }
      showToast("Study material copied to clipboard.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not copy study material.");
    }
  }

  function downloadResult() {
    if (!state.result) return;
    const fileBase = (state.file ? state.file.name.replace(/\.[^.]+$/, "") : "study-notes").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-");
    const blob = new Blob([`${state.resultTitle}\n\n${state.result}\n`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileBase}-${state.action}.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Your study material has been downloaded.");
  }

  function init() {
    document.getElementById("today-label").textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date());
    elements.input.addEventListener("change", event => handleFile(event.target.files[0]));
    elements.removeFile.addEventListener("click", clearFile);
    elements.generate.addEventListener("click", generate);
    elements.copyButton.addEventListener("click", copyResult);
    elements.downloadButton.addEventListener("click", downloadResult);
    elements.saveEndpoint.addEventListener("click", saveEndpoint);
    document.querySelectorAll(".tool-card").forEach(card => card.addEventListener("click", () => setAction(card.dataset.action)));

    ["dragenter", "dragover"].forEach(type => elements.dropzone.addEventListener(type, event => {
      event.preventDefault();
      elements.dropzone.classList.add("drag-over");
    }));
    ["dragleave", "drop"].forEach(type => elements.dropzone.addEventListener(type, event => {
      event.preventDefault();
      elements.dropzone.classList.remove("drag-over");
    }));
    elements.dropzone.addEventListener("drop", event => handleFile(event.dataTransfer.files[0]));

    elements.menuToggle.addEventListener("click", () => {
      const isOpen = elements.sidebar.classList.toggle("open");
      elements.menuToggle.setAttribute("aria-expanded", String(isOpen));
    });
    document.querySelectorAll(".nav-link").forEach(link => link.addEventListener("click", () => {
      document.querySelectorAll(".nav-link").forEach(item => item.classList.toggle("active", item === link));
      elements.sidebar.classList.remove("open");
      elements.menuToggle.setAttribute("aria-expanded", "false");
    }));
    document.getElementById("help-button").addEventListener("click", () => {
      document.getElementById("ai-settings").scrollIntoView({ behavior: "smooth", block: "center" });
      showToast("For AI responses, configure a server-side endpoint in AI connection.");
    });

    try {
      const savedEndpoint = localStorage.getItem("studywise-endpoint") || "";
      elements.endpoint.value = savedEndpoint;
      state.endpoint = savedEndpoint ? new URL(savedEndpoint, window.location.href).href : "";
      updateConnectionState(savedEndpoint);
    } catch {
      updateConnectionState("");
      elements.connectionMessage.style.color = "#bd4750";
      elements.connectionMessage.textContent = "Browser storage is unavailable; endpoint settings will only last for this page session.";
    }
    updateStats();
  }

  init();
})();