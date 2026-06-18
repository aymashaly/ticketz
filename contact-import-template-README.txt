Ticketz — Contact Import Template (CSV)

HOW TO USE
1. Open the CSV in Excel, Google Sheets, or any text editor.
2. Required columns: name, number. Email and tags are optional.
3. Tags: comma-separated, e.g.   vip, lead, follow-up
4. Save (encoding: UTF-8). If Excel shows Arabic as ???, do File > Save As
   and pick "CSV UTF-8 (Comma delimited)".
5. In ticketz: Contacts > Import > upload the file.

COLUMN REFERENCE
  name    - contact's full name (Arabic, English, or mixed; e.g. محمد علي, John Smith)
  number  - phone in E.164 with +country code (e.g. +201234567890)
  email   - optional, valid email if present
  tags    - optional, comma-separated

ACCEPTED HEADER ALIASES (any of these will also work)
  name    : name, Name, fullname, Full Name, contact, Contact, اسم, الاسم, الإسم
  number  : number, Number, phone, Phone, mobile, Mobile, whatsapp, رقم, جوال, موبايل, هاتف
  email   : email, Email, e-mail, E-mail, mail, Mail, بريد, البريد
  tags    : tags, Tags, tag, Tag, label, labels, علامة, وسم, etiqueta, etiquetas

NUMBER NORMALIZATION
  Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) and Persian digits (۰۱۲۳۴۵۶۷۸۹) are
  auto-converted to Latin (0123456789) before saving.
  Spaces and dashes in numbers are stripped.

LIMITS
  Max rows per file: 10,000
  Duplicate detection: a contact is a duplicate if number OR email already exists.
