// Global state for current data mode
let currentDataMode = "database"; // 'database' or 'youtube'
let currentYoutubeVideoId = null;

// Load initial data
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  setupSearch();
  setupYoutubeAnalyzer();
  loadYoutubeLinks();
});

// Load and display data (with mode support)
async function loadData(videoId = null) {
  try {
    let data;
    if (videoId) {
      // Load YouTube data
      const response = await fetch(`/api/youtube/data/${videoId}`);
      if (!response.ok) throw new Error("Video data not found");
      data = await response.json();
      currentDataMode = "youtube";
      currentYoutubeVideoId = videoId;
      updateDataModeIndicator(data.title);
    } else {
      // Load default database data
      const response = await fetch("/api/data");
      data = await response.json();
      currentDataMode = "database";
      currentYoutubeVideoId = null;
      updateDataModeIndicator(null);
    }

    // Update stats
    updateStats(data);

    // For YouTube data, use the words from analysis
    if (data.source === "youtube") {
      displayPositiveWords(data.positive_words);
      displayNegativeWords(data.negative_words);
    } else {
      displayPositiveWords(data.positive);
      displayNegativeWords(data.negative);
    }
  } catch (error) {
    console.error("Error loading data:", error);
    document.getElementById("positiveList").innerHTML =
      '<div class="no-results">Error loading data</div>';
    document.getElementById("negativeList").innerHTML =
      '<div class="no-results">Error loading data</div>';
  }
}

// Update stats section
function updateStats(data) {
  document.getElementById("statPositiveCount").textContent =
    data.total_positive;
  document.getElementById("statNegativeCount").textContent =
    data.total_negative;
  document.getElementById("statTotalCount").textContent = data.total_words;

  if (data.source === "youtube") {
    document.getElementById("statPositiveWeight").textContent =
      `Sentimen: ${data.avg_positive_weight}%`;
    document.getElementById("statNegativeWeight").textContent =
      `Sentimen: ${Math.abs(data.avg_negative_weight)}%`;
    document.getElementById("statTotalLabel").textContent = "Total Komentar";
  } else {
    const posWeight =
      typeof data.avg_positive_weight === "number"
        ? data.avg_positive_weight.toFixed(2)
        : data.avg_positive_weight;
    const negWeight =
      typeof data.avg_negative_weight === "number"
        ? data.avg_negative_weight.toFixed(2)
        : data.avg_negative_weight;
    document.getElementById("statPositiveWeight").textContent =
      `Avg Weight: ${posWeight}`;
    document.getElementById("statNegativeWeight").textContent =
      `Avg Weight: ${negWeight}`;
    document.getElementById("statTotalLabel").textContent = "Dataset Lengkap";
  }
}

// Update data mode indicator
function updateDataModeIndicator(youtubeTitle) {
  const statsSection = document.querySelector(".stats-section");
  let indicator = document.getElementById("dataModeIndicator");

  if (!indicator) {
    indicator = document.createElement("div");
    indicator.id = "dataModeIndicator";
    indicator.style.cssText = `
      text-align: center;
      padding: 12px;
      margin-bottom: 20px;
      border-radius: 8px;
      font-size: 0.9em;
      font-weight: 500;
    `;
    statsSection.parentNode.insertBefore(indicator, statsSection);
  }

  if (youtubeTitle) {
    indicator.textContent = `📺 Menampilkan data dari: ${youtubeTitle}`;
    indicator.style.background = "rgba(239, 68, 68, 0.15)";
    indicator.style.color = "#ef4444";
    indicator.style.border = "1px solid rgba(239, 68, 68, 0.3)";
  } else {
    indicator.textContent = `📊 Menampilkan data dari: Database Sentiment Analisis`;
    indicator.style.background = "rgba(99, 102, 241, 0.15)";
    indicator.style.color = "#6366f1";
    indicator.style.border = "1px solid rgba(99, 102, 241, 0.3)";
  }
}

// Display positive words
function displayPositiveWords(words) {
  const container = document.getElementById("positiveList");

  if (!words || words.length === 0) {
    container.innerHTML =
      '<div class="no-results">Tidak ada data positif</div>';
    return;
  }

  const html = words
    .map(
      (word) => `
        <div class="word-item">
            <span class="word-text">${escapeHtml(word.word)}</span>
            <span class="word-weight">+${word.weight}</span>
        </div>
    `,
    )
    .join("");

  container.innerHTML = html;
}

// Display negative words
function displayNegativeWords(words) {
  const container = document.getElementById("negativeList");

  if (!words || words.length === 0) {
    container.innerHTML =
      '<div class="no-results">Tidak ada data negatif</div>';
    return;
  }

  const html = words
    .map(
      (word) => `
        <div class="word-item">
            <span class="word-text">${escapeHtml(word.word)}</span>
            <span class="word-weight">${word.weight}</span>
        </div>
    `,
    )
    .join("");

  container.innerHTML = html;
}

// Setup search functionality
function setupSearch() {
  const searchInput = document.getElementById("searchInput");

  searchInput.addEventListener("input", async (e) => {
    const query = e.target.value.trim();

    if (query.length === 0) {
      document.getElementById("resultsSection").style.display = "none";
      // Reset to database mode
      loadData();
      return;
    }

    if (query.length < 2) {
      return;
    }

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query)}`,
      );
      const data = await response.json();

      displaySearchResults(data);
    } catch (error) {
      console.error("Error searching:", error);
    }
  });
}

// Display search results
function displaySearchResults(results) {
  const resultsSection = document.getElementById("resultsSection");
  const positiveContainer = document.getElementById("searchPositive");
  const negativeContainer = document.getElementById("searchNegative");

  // Display positive results
  if (results.positive && results.positive.length > 0) {
    const html = results.positive
      .map(
        (word) => `
            <div class="search-result-item">
                <span>${escapeHtml(word.word)}</span>
                <span class="word-weight" style="color: #10b981;">+${word.weight}</span>
            </div>
        `,
      )
      .join("");
    positiveContainer.innerHTML = html;
  } else {
    positiveContainer.innerHTML =
      '<div class="no-results">Tidak ada hasil positif</div>';
  }

  // Display negative results
  if (results.negative && results.negative.length > 0) {
    const html = results.negative
      .map(
        (word) => `
            <div class="search-result-item">
                <span>${escapeHtml(word.word)}</span>
                <span class="word-weight" style="color: #ef4444;">${word.weight}</span>
            </div>
        `,
      )
      .join("");
    negativeContainer.innerHTML = html;
  } else {
    negativeContainer.innerHTML =
      '<div class="no-results">Tidak ada hasil negatif</div>';
  }

  resultsSection.style.display = "block";
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Helper function to escape HTML
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Member Modal Functions
// Mapping foto untuk setiap member
const memberPhotos = {
  1: "Fateh.jpeg", // Muhammad Fathi Farhad
  2: "Pasha.jpeg", // Muhammad Pasha Febrio
  3: "Nuha.jpeg", // Naqiyah Nuha
};

const memberData = {
  1: {
    name: "Muhammad Fathi Farhad",
    role: "Developer",
    description:
      "Pengembang website yang berdedikasi dalam membangun website, memprogram big data dan menguasai berbagai macam pemrograman. Antara lain html,css, python dan java script (kerja sama: Hub 081615600457).",
  },
  2: {
    name: "Muhammad Pasha Febrio",
    role: "Developer",
    description:
      "Anggota kedua dengan keahlian dalam backend development dan database management, berdedikasi dalam membangun website  serta data base dan mempunyai keahlian mengoding tingkat tinggi.",
  },
  3: {
    name: "Naqiyah Nuha",
    role: "Developer",
    description:
      "Anggota ketiga dengan fokus pada frontend design dan user experience. Berdedikasi dalam menciptakan antarmuka yang menarik dan mudah digunakan, serta memiliki keahlian dalam desain grafis untuk meningkatkan estetika website.",
  },
};

function openMemberModal(memberId) {
  const modal = document.getElementById("memberModal");
  const member = memberData[memberId];

  document.getElementById("modalImage").src =
    `/static/members/${memberPhotos[memberId]}`;
  document.getElementById("modalName").textContent = member.name;
  document.getElementById("modalRole").textContent = member.role;
  document.getElementById("modalDescription").textContent = member.description;

  modal.style.display = "block";
  document.body.style.overflow = "hidden";
}

function closeMemberModal() {
  const modal = document.getElementById("memberModal");
  modal.style.display = "none";
  document.body.style.overflow = "auto";
}

// Close modal when clicking outside
window.onclick = function (event) {
  const modal = document.getElementById("memberModal");
  if (event.target == modal) {
    closeMemberModal();
  }
};

// ===== YouTube Analyzer Functions =====

// Setup YouTube Analyzer
function setupYoutubeAnalyzer() {
  const analyzeBtn = document.getElementById("analyzeBtn");
  const youtubeUrl = document.getElementById("youtubeUrl");

  analyzeBtn.addEventListener("click", analyzeYoutubeLink);

  youtubeUrl.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      analyzeYoutubeLink();
    }
  });

  // Close results button
  const closeResultsBtn = document.getElementById("closeResults");
  if (closeResultsBtn) {
    closeResultsBtn.addEventListener("click", () => {
      document.getElementById("youtubeResults").style.display = "none";
    });
  }
}

// Analyze YouTube Link
async function analyzeYoutubeLink() {
  const urlInput = document.getElementById("youtubeUrl");
  const url = urlInput.value.trim();
  const errorDiv = document.getElementById("youtubeError");
  const loadingDiv = document.getElementById("youtubeLoading");

  // Reset errors
  errorDiv.style.display = "none";
  errorDiv.textContent = "";

  if (!url) {
    errorDiv.textContent = "Silakan masukkan URL YouTube";
    errorDiv.style.display = "block";
    return;
  }

  loadingDiv.style.display = "block";

  try {
    const response = await fetch("/api/youtube/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: url }),
    });

    const result = await response.json();

    if (response.ok || response.status === 201) {
      // Success - clear input and reload links
      urlInput.value = "";
      loadingDiv.style.display = "none";

      // Show success message briefly
      errorDiv.style.color = "#10b981";
      errorDiv.textContent = result.message || "Link berhasil dianalisis!";
      errorDiv.style.display = "block";

      // Show analysis results
      if (result.data) {
        displayAnalysisResult(result.data);
      }

      // Reload links list
      setTimeout(() => {
        loadYoutubeLinks();
        errorDiv.style.display = "none";
      }, 1500);
    } else if (response.status === 200 && result.data) {
      // Link already analyzed
      urlInput.value = "";
      loadingDiv.style.display = "none";
      errorDiv.style.color = "#f5a623";
      errorDiv.textContent =
        "Link ini sudah pernah dianalisis, menampilkan hasil sebelumnya...";
      errorDiv.style.display = "block";

      displayAnalysisResult(result.data);

      setTimeout(() => {
        errorDiv.style.display = "none";
      }, 2000);
    } else {
      throw new Error(result.error || "Gagal menganalisis link");
    }
  } catch (error) {
    loadingDiv.style.display = "none";
    errorDiv.style.color = "#fca5a5";
    errorDiv.textContent =
      error.message || "Terjadi kesalahan saat menganalisis link";
    errorDiv.style.display = "block";
    console.error("Error analyzing YouTube link:", error);
  }
}

// Load YouTube Links
async function loadYoutubeLinks() {
  try {
    const response = await fetch("/api/youtube/list");
    const links = await response.json();

    displayYoutubeLinks(links);
  } catch (error) {
    console.error("Error loading YouTube links:", error);
  }
}

// Display YouTube Links
function displayYoutubeLinks(links) {
  const container = document.getElementById("youtubeList");

  if (!links || links.length === 0) {
    container.innerHTML =
      '<div class="no-links">Belum ada link yang dianalisis</div>';
    return;
  }

  const html = links
    .map(
      (link) => `
        <div class="youtube-link-card" onclick="handleYoutubeCardClick(${JSON.stringify(link).replace(/"/g, "&quot;")})">
          <div class="link-card-header">
            <div class="link-card-title" title="${escapeHtml(link.title)}">
              ${escapeHtml(link.title)}
            </div>
            <button class="link-card-delete" onclick="deleteYoutubeLink(event, '${link.video_id}')">
              Hapus
            </button>
          </div>
          <div class="link-card-stats">
            <div class="link-card-stat">
              <span>Positif</span>
              <span class="stat-positive">${link.analysis.positive}%</span>
            </div>
            <div class="link-card-stat">
              <span>Negatif</span>
              <span class="stat-negative">${link.analysis.negative}%</span>
            </div>
          </div>
          <small style="color: var(--text-secondary);">
            ${new Date(link.added_date).toLocaleDateString("id-ID")}
          </small>
        </div>
      `,
    )
    .join("");

  container.innerHTML = html;
}

// Handle YouTube card click - load data and show results
async function handleYoutubeCardClick(linkData) {
  // Load YouTube data into stats section
  await loadData(linkData.video_id);

  // Show analysis results
  displayAnalysisResult(linkData);

  // Scroll to stats
  setTimeout(() => {
    document
      .querySelector(".stats-section")
      .scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);
}

// Delete YouTube Link
async function deleteYoutubeLink(event, videoId) {
  event.stopPropagation();

  if (!confirm("Yakin ingin menghapus link ini?")) {
    return;
  }

  try {
    const response = await fetch(`/api/youtube/delete/${videoId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      loadYoutubeLinks();
    }
  } catch (error) {
    console.error("Error deleting YouTube link:", error);
    alert("Gagal menghapus link");
  }
}

// Display Analysis Result
function displayAnalysisResult(linkData) {
  const resultsDiv = document.getElementById("youtubeResults");

  // Update result content
  document.getElementById("resultTitle").textContent = linkData.title;
  document.getElementById("resultUrl").href = linkData.url;
  document.getElementById("resultUrl").textContent = "Buka video →";

  document.getElementById("resultPositive").textContent =
    linkData.analysis.positive + "%";
  document.getElementById("resultNegative").textContent =
    linkData.analysis.negative + "%";
  document.getElementById("resultNeutral").textContent =
    linkData.analysis.neutral + "%";

  // Show detailed stats
  const detailsHtml = `
    <p><strong>Total Komentar Dianalisis:</strong> ${linkData.analysis.total_comments}</p>
    <p><strong>Komentar Positif:</strong> ${linkData.analysis.positive_count} komentar</p>
    <p><strong>Komentar Negatif:</strong> ${linkData.analysis.negative_count} komentar</p>
    <p><strong>Komentar Netral:</strong> ${linkData.analysis.neutral_count} komentar</p>
    <p><strong>Tanggal Analisis:</strong> ${new Date(linkData.added_date).toLocaleString("id-ID")}</p>
  `;

  document.getElementById("resultDetails").innerHTML = detailsHtml;

  // Show results
  resultsDiv.style.display = "block";
  resultsDiv.scrollIntoView({ behavior: "smooth", block: "start" });
}
