import { readFileSync, writeFileSync, existsSync } from 'fs';

const files = [
  'app/(public)/login/page.tsx',
  'app/(public)/register/page.tsx',
  'app/(investor)/checkout/[campaignId]/page.tsx',
];

const oldImport = "import { useActionState } from 'react';";
const newImport = "import { useFormState as useActionState } from 'react-dom';";

files.forEach((file) => {
  if (!existsSync(file)) {
    console.log('MISSING (skipping):', file);
    return;
  }
  let content = readFileSync(file, 'utf8');
  if (content.includes(oldImport)) {
    content = content.replace(oldImport, newImport);
    writeFileSync(file, content, 'utf8');
    console.log('Fixed:', file);
  } else {
    console.log('Import not found (may already be correct):', file);
  }
});
