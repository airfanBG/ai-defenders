// Логата се пазят в базата като base64. Приемаме само PNG, JPEG и WebP,
// проверени по първите байтове (SVG не, защото може да съдържа скриптове).
const MAX_LOGO_BYTES = 400 * 1024;

function sniff(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export function decodeLogo(b64) {
  if (typeof b64 !== "string" || !b64) return { error: "Липсва лого." };
  let bin;
  try {
    bin = atob(b64.replace(/^data:[^,]*,/, ""));
  } catch {
    return { error: "Логото не е валидна картинка." };
  }
  if (bin.length > MAX_LOGO_BYTES) return { error: "Логото е твърде голямо (над 400 KB)." };
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const mime = sniff(bytes);
  if (!mime) return { error: "Логото трябва да е PNG, JPEG или WebP." };
  return { logo: btoa(bin), mime };
}

export function validatePartner(b, { requireLogo }) {
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 60) : "";
  if (!name) return { error: "Напиши име на партньора." };
  const url = typeof b.url === "string" ? b.url.trim().slice(0, 300) : "";
  if (url && !/^https?:\/\/[^\s]+$/i.test(url)) return { error: "Линкът трябва да започва с https://" };
  const bg = typeof b.bg === "string" && /^#[0-9a-f]{6}$/i.test(b.bg) ? b.bg.toLowerCase() : "#ffffff";
  const out = { name, url: url || null, bg };
  if (b.logo || requireLogo) {
    const l = decodeLogo(b.logo);
    if (l.error) return l;
    Object.assign(out, l);
  }
  return { partner: out };
}

export function publicPartner(row) {
  return {
    id: row.id, name: row.name, url: row.url, bg: row.bg,
    logo: `/api/partners/${row.id}/logo?v=${encodeURIComponent(row.updated_at)}`,
  };
}
