// src/lib/renderMarkdown.ts
// Moteur de rendu markdown → HTML pour les bulles de chat dans les Builders.
// Supporte : titres (###), **gras**, *italique*, `code`, listes à puces,
// tableaux simples, > citations, [liens](url).

export function renderMarkdownToHtml(md: string): string {
  let html = md;

  // Échapper le HTML existant
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // ── Phase 1 : blocs (titres, citations, tableaux, listes) ──
  const lines = html.split("\n");
  const result: string[] = [];
  let inTable = false;
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fermer table si on était dedans
    if (inTable && !/^\|(.+)\|$/.test(trimmed)) {
      result.push("</tbody></table>");
      inTable = false;
    }

    // Fermer liste si on était dedans
    if (inList && !/^[\-\*]\s/.test(trimmed)) {
      result.push("</ul>");
      inList = false;
    }

    // Titres ### (h1-h6 en markdown)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 6);
      result.push(`<h${level} class="text-white font-semibold mt-2 mb-1 ${level <= 2 ? "text-sm" : "text-xs"}">${headingMatch[2]}</h${level}>`);
      continue;
    }

    // Citations >
    if (/^>\s?(.+)$/.test(trimmed)) {
      const quoteContent = trimmed.replace(/^>\s?/, "");
      result.push(`<blockquote class="border-l-2 border-gray-500 pl-3 my-1 text-gray-400 italic text-xs">${quoteContent}</blockquote>`);
      continue;
    }

    // Tableaux
    if (/^\|(.+)\|$/.test(trimmed)) {
      if (/^\|[\s\-:]+\|/.test(trimmed)) continue; // skip separator
      if (!inTable) {
        result.push('<table class="w-full text-[11px] border-collapse border border-gray-600 rounded overflow-hidden my-1"><tbody>');
        inTable = true;
      }
      const cells = trimmed.slice(1, -1).split("|").map(c => c.trim());
      result.push("<tr>" + cells.map(c => `<td class="border border-gray-600 px-2 py-1 text-gray-300">${c}</td>`).join("") + "</tr>");
      continue;
    }

    // Listes à puces
    if (/^[\-\*]\s(.+)$/.test(trimmed)) {
      if (!inList) {
        result.push('<ul class="list-disc ml-4 my-1 text-gray-200 text-xs space-y-0.5">');
        inList = true;
      }
      const itemText = trimmed.replace(/^[\-\*]\s/, "");
      result.push(`<li>${itemText}</li>`);
      continue;
    }

    // Ligne normale
    result.push(trimmed || "<br>");
  }

  // Fermer les blocs ouverts
  if (inTable) result.push("</tbody></table>");
  if (inList) result.push("</ul>");

  html = result.join("\n");

  // ── Phase 2 : inline (dans l'ordre) ──

  // Liens [texte](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-400 underline hover:text-indigo-300">$1</a>');

  // Code inline
  html = html.replace(/`([^`]+)`/g,
    '<code class="bg-gray-700 text-amber-400 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>');

  // Gras
  html = html.replace(/\*\*([^*]+)\*\*/g,
    '<strong class="font-bold text-white">$1</strong>');

  // Italique
  html = html.replace(/\*([^*]+)\*/g,
    '<em class="italic">$1</em>');

  // Sauts de ligne restants
  html = html.replace(/\n/g, "<br>");

  return html;
}
