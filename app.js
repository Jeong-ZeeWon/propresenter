// ProPresenter 6 (.pro6) file generator
// Builds a minimal but valid RVPresentationDocument XML from plain text input.

(function () {
  const textInput = document.getElementById("text-input");
  const splitModeSelect = document.getElementById("split-mode");
  const fileNameInput = document.getElementById("file-name");
  const aspectRatioSelect = document.getElementById("aspect-ratio");
  const fontFamilyInput = document.getElementById("font-family");
  const fontSizeInput = document.getElementById("font-size");
  const textAlignSelect = document.getElementById("text-align");
  const textColorInput = document.getElementById("text-color");
  const bgColorInput = document.getElementById("bg-color");
  const generateBtn = document.getElementById("generate-btn");
  const statusEl = document.getElementById("status");
  const previewOutput = document.getElementById("preview-output");

  // ---------- Helpers ----------

  function generateUUID() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID().toUpperCase();
    }
    // Fallback UUIDv4
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
      .replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      })
      .toUpperCase();
  }

  function escapeXml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function escapeRtf(str) {
    return String(str)
      .replace(/\\/g, "\\\\")
      .replace(/\{/g, "\\{")
      .replace(/\}/g, "\\}");
  }

  function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return { r, g, b };
  }

  function hexToFloatColor(hex, alpha = 1) {
    const { r, g, b } = hexToRgb(hex);
    return `${(r / 255).toFixed(6)} ${(g / 255).toFixed(6)} ${(b / 255).toFixed(6)} ${alpha}`;
  }

  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  // ---------- Text parsing ----------

  /**
   * Parses raw text into a list of groups, each containing slides.
   * A line starting with "#" sets the current group's name and does not
   * become a slide itself. Blank lines separate slides (paragraph mode)
   * or every non-empty line is its own slide (line mode).
   */
  function parseText(rawText, splitMode) {
    const groups = [];
    let currentGroup = { name: "Slides", slides: [] };
    groups.push(currentGroup);

    const normalized = rawText.replace(/\r\n/g, "\n");

    if (splitMode === "line") {
      const lines = normalized.split("\n");
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line === "") continue;
        if (line.startsWith("#")) {
          const name = line.slice(1).trim() || "Slides";
          if (currentGroup.slides.length === 0) {
            currentGroup.name = name;
          } else {
            currentGroup = { name, slides: [] };
            groups.push(currentGroup);
          }
          continue;
        }
        currentGroup.slides.push([line]);
      }
    } else {
      const blocks = normalized.split(/\n\s*\n+/);
      for (const block of blocks) {
        const lines = block
          .split("\n")
          .map((l) => l.trim())
          .filter((l, idx, arr) => !(l === "" && (idx === 0 || idx === arr.length - 1)));

        if (lines.length === 0) continue;

        if (lines[0].startsWith("#")) {
          const name = lines[0].slice(1).trim() || "Slides";
          if (currentGroup.slides.length === 0) {
            currentGroup.name = name;
          } else {
            currentGroup = { name, slides: [] };
            groups.push(currentGroup);
          }
          const remaining = lines.slice(1).filter((l) => l !== "");
          if (remaining.length > 0) {
            currentGroup.slides.push(remaining);
          }
          continue;
        }

        const nonEmpty = lines.filter((l) => l !== "");
        if (nonEmpty.length > 0) {
          currentGroup.slides.push(nonEmpty);
        }
      }
    }

    return groups.filter((g) => g.slides.length > 0);
  }

  // ---------- RTF generation ----------

  function buildRtf(lines, options) {
    const { fontFamily, fontSizePt, colorHex, align } = options;
    const alignCmd = { left: "\\ql", center: "\\qc", right: "\\qr" }[align] || "\\qc";
    const { r, g, b } = hexToRgb(colorHex);
    const halfPoints = Math.round(fontSizePt * 2);
    const body = lines.map(escapeRtf).join("\\line\n");

    return (
      "{\\rtf1\\ansi\\ansicpg65001\\deff0\\deflang1033" +
      `{\\fonttbl{\\f0\\fnil\\fcharset0 ${fontFamily};}}` +
      `{\\colortbl;\\red${r}\\green${g}\\blue${b};}` +
      `\\viewkind4\\uc1${alignCmd}\\f0\\fs${halfPoints} \\cf1 ${body}}`
    );
  }

  // ---------- pro6 XML generation ----------

  function buildSlideXml(lines, width, height, options) {
    const rtf = buildRtf(lines, options);
    const rtfBase64 = utf8ToBase64(rtf);
    const fillColor = hexToFloatColor(options.colorHex, 1);
    const slideUuid = generateUUID();

    return `				<RVDisplaySlide UUID="${slideUuid}" backgroundColor="0 0 0 0" chordChartPath="" drawingBackgroundColor="false" enabled="true" highlightColor="" hotKey="" label="" notes="" socialItemNotes="">
					<displayElements containerClass="NSMutableArray" rvXMLIvarName="displayElements">
						<RVTextElement adjustsHeightToFit="false" bezelRadius="0" displayDelay="0" displayName="Default" drawingFill="false" drawingShadow="false" drawingStroke="false" fillColor="${fillColor}" fromTemplate="false" locked="false" persistent="true" revealType="0" rotation="0" source="" typeID="0" verticalAlignment="1" RTFData="${rtfBase64}">
							<RVRect3D rvXMLIvarName="position">{0 0 ${width} ${height}}</RVRect3D>
							<RVRect3D rvXMLIvarName="shadow">{0 0 0 0}</RVRect3D>
							<dictionary rvXMLIvarName="stroke">
								<NSColor rvXMLIvarName="RVShapeElementStrokeColorKey">0 0 0 0</NSColor>
								<NSNumber rvXMLIvarName="RVShapeElementStrokeWidthKey" hint="double">0</NSNumber>
							</dictionary>
						</RVTextElement>
					</displayElements>
					<cues containerClass="NSMutableArray" rvXMLIvarName="cues">
					</cues>
				</RVDisplaySlide>`;
  }

  function buildGroupXml(group, width, height, options) {
    const groupUuid = generateUUID();
    const slidesXml = group.slides
      .map((lines) => buildSlideXml(lines, width, height, options))
      .join("\n");

    return `		<RVSlideGrouping name="${escapeXml(group.name)}" uuid="${groupUuid}" color="0 0 0 0">
			<slides containerClass="NSMutableArray" rvXMLIvarName="slides">
${slidesXml}
			</slides>
		</RVSlideGrouping>`;
  }

  function buildPro6Document(groups, options) {
    const [width, height] = options.aspectRatio.split("x").map(Number);
    const backgroundColor = hexToFloatColor(options.bgColorHex, 1);
    const docUuid = generateUUID();
    const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");

    const groupsXml = groups.map((g) => buildGroupXml(g, width, height, options)).join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<RVPresentationDocument CCLIArtistCredits="" CCLIAuthor="" CCLICopyrightYear="" CCLIDisplay="false" CCLIPublisher="" CCLISongNumber="" CCLISongTitle="" backgroundColor="${backgroundColor}" buildNumber="6016" category="Presentation" chordChartPath="" docType="0" drawingBackgroundColor="false" height="${height}" lastDateUsed="${now}" notes="" os="1" resourcesDirectory="" selectedArrangementID="" usedCount="0" uuid="${docUuid}" versionNumber="600" width="${width}">
	<timeline timeOffSet="0" selectedMediaTrackIndex="0" duration="0" loop="false" rvXMLIvarName="timeline">
		<timeCues containerClass="NSMutableArray" rvXMLIvarName="timeCues">
		</timeCues>
		<mediaTracks containerClass="NSMutableArray" rvXMLIvarName="mediaTracks">
		</mediaTracks>
	</timeline>
	<groups containerClass="NSMutableArray" rvXMLIvarName="groups">
${groupsXml}
	</groups>
	<arrangements containerClass="NSMutableArray" rvXMLIvarName="arrangements">
	</arrangements>
</RVPresentationDocument>
`;
  }

  // ---------- UI ----------

  function getOptions() {
    return {
      aspectRatio: aspectRatioSelect.value,
      fontFamily: fontFamilyInput.value.trim() || "Apple SD Gothic Neo",
      fontSizePt: Number(fontSizeInput.value) || 60,
      align: textAlignSelect.value,
      colorHex: textColorInput.value,
      bgColorHex: bgColorInput.value,
    };
  }

  function renderPreview(groups) {
    previewOutput.innerHTML = "";

    const totalSlides = groups.reduce((sum, g) => sum + g.slides.length, 0);
    if (totalSlides === 0) {
      const empty = document.createElement("p");
      empty.className = "preview-empty";
      empty.textContent = "표시할 슬라이드가 없습니다. 텍스트를 입력해주세요.";
      previewOutput.appendChild(empty);
      return;
    }

    for (const group of groups) {
      const groupLabel = document.createElement("div");
      groupLabel.className = "preview-group";
      groupLabel.textContent = `[${group.name}] (${group.slides.length} 슬라이드)`;
      previewOutput.appendChild(groupLabel);

      for (const lines of group.slides) {
        const slideEl = document.createElement("div");
        slideEl.className = "preview-slide";
        slideEl.textContent = lines.join("\n");
        previewOutput.appendChild(slideEl);
      }
    }
  }

  function updatePreview() {
    const groups = parseText(textInput.value, splitModeSelect.value);
    renderPreview(groups);
  }

  function downloadFile(content, filename) {
    const blob = new Blob([content], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleGenerate() {
    const groups = parseText(textInput.value, splitModeSelect.value);
    const totalSlides = groups.reduce((sum, g) => sum + g.slides.length, 0);

    if (totalSlides === 0) {
      statusEl.textContent = "생성할 텍스트가 없습니다.";
      return;
    }

    const options = getOptions();
    const xml = buildPro6Document(groups, options);

    let fileName = (fileNameInput.value || "presentation").trim();
    fileName = fileName.replace(/\.pro6$/i, "");
    downloadFile(xml, `${fileName}.pro6`);

    statusEl.textContent = `${totalSlides}개의 슬라이드를 포함한 "${fileName}.pro6" 파일을 생성했습니다.`;
  }

  textInput.addEventListener("input", updatePreview);
  splitModeSelect.addEventListener("change", updatePreview);
  generateBtn.addEventListener("click", handleGenerate);

  updatePreview();
})();
