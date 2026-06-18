import { head } from "lodash";
import XLSX from "xlsx";
import { has } from "lodash";
import ContactListItem from "../../models/ContactListItem";
import CheckContactNumber from "../WbotServices/CheckNumber";
import { logger } from "../../utils/logger";

// Convert Arabic-Indic digits (٠-٩) and Persian digits (۰-۹) to Western (0-9).
// Returns "" for null/undefined/non-string values.
const arabicToWesternDigits = (val: unknown): string => {
  if (val === null || val === undefined) return "";
  const s = `${val}`;
  return s
    .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0));
};

// Strip everything that is NOT a digit (Western or Arabic-Indic).
// Keeps Western 0-9, Arabic-Indic ٠-٩, and Persian ۰-۹.
const stripNonDigits = (val: unknown): string => {
  if (val === null || val === undefined) return "";
  return arabicToWesternDigits(val).replace(/\D/g, "");
};

// Pull the first non-empty value across a list of candidate header keys.
// Case-insensitive + trims. Falls back to empty string.
const pickFirst = (row: any, keys: string[]): string => {
  for (const key of keys) {
    if (has(row, key)) {
      const raw = row[key];
      if (raw !== null && raw !== undefined && `${raw}`.trim() !== "") {
        return `${raw}`.trim();
      }
    }
  }
  return "";
};

export async function ImportContacts(
  contactListId: number,
  companyId: number,
  file: Express.Multer.File | undefined
) {
  const workbook = XLSX.readFile(file?.path as string, {
    cellDates: true,
    raw: false
  });
  // Use the first sheet explicitly. Read with header row at index 0.
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, {
    header: 0,
    defval: "",
    raw: false,
    blankrows: false
  });

  const contacts = rows.map(row => {
    // Name — accept EN, PT, AR headers
    const name = pickFirst(row, [
      "name",
      "Name",
      "nome",
      "Nome",
      "اسم",
      "الاسم",
      "الإسم"
    ]);

    // Number — accept EN, PT, AR headers, then convert any Arabic-Indic
    // digits to Western and strip non-digits (but keep the leading "+").
    const numberRaw = pickFirst(row, [
      "number",
      "Number",
      "phone",
      "Phone",
      "mobile",
      "Mobile",
      "whatsapp",
      "Whatsapp",
      "WhatsApp",
      "numero",
      "número",
      "Numero",
      "Número",
      "celular",
      "Celular",
      "telefone",
      "Telefone",
      "رقم",
      "جوال",
      "موبايل",
      "هاتف"
    ]);
    const number = stripNonDigits(numberRaw);

    // Email — accept EN, PT, AR headers
    const email = pickFirst(row, [
      "email",
      "e-mail",
      "Email",
      "E-mail",
      "EMAIL",
      "بريد",
      "البريد",
      "إيميل"
    ]).toLowerCase();

    // Tags — accept EN, PT, AR headers. Comma- or semicolon-separated
    // values within a single cell become a comma-separated string.
    const tagsRaw = pickFirst(row, [
      "tags",
      "Tags",
      "TAGS",
      "tag",
      "Tag",
      "TAG",
      "etiqueta",
      "Etiqueta",
      "etiquetas",
      "Etiquetas",
      "علامة",
      "علامات",
      "وسم",
      "أوسمة"
    ]);
    const tags = tagsRaw
      .split(/[,;|]/)
      .map(t => t.trim())
      .filter(Boolean)
      .join(",");

    return {
      name,
      number,
      email,
      tags,
      contactListId,
      companyId
    };
  });

  // Drop rows without a usable number — they'd never match anyway.
  const validContacts = contacts.filter(c => c.number && c.number.length >= 6);

  const contactList: ContactListItem[] = [];

  for (const contact of validContacts) {
    const [newContact, created] = await ContactListItem.findOrCreate({
      where: {
        number: `${contact.number}`,
        contactListId: contact.contactListId,
        companyId: contact.companyId
      },
      defaults: contact
    });
    // If the contact already existed, refresh tags/email/name so re-imports
    // pick up the latest values without duplicating rows.
    if (!created) {
      let dirty = false;
      if (contact.name && newContact.name !== contact.name) {
        newContact.name = contact.name;
        dirty = true;
      }
      if (contact.email && newContact.email !== contact.email) {
        newContact.email = contact.email;
        dirty = true;
      }
      if (contact.tags && newContact.tags !== contact.tags) {
        newContact.tags = contact.tags;
        dirty = true;
      }
      if (dirty) {
        await newContact.save();
      }
      continue;
    }
    contactList.push(newContact);
  }

  if (contactList) {
    for (let newContact of contactList) {
      try {
        const response = await CheckContactNumber(newContact.number, companyId);
        newContact.isWhatsappValid = response.exists;
        const number = arabicToWesternDigits(response.jid).replace(/\D/g, "");
        newContact.number = number;
        await newContact.save();
      } catch (e) {
        logger.error(`Número de contato inválido: ${newContact.number}`);
      }
    }
  }

  return contactList;
}
