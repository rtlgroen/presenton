import { TemplateListItem } from "../services/api/template";

export function partitionTemplatesByDefault(templates: TemplateListItem[]) {
  const defaultTemplates: TemplateListItem[] = [];
  const customTemplates: TemplateListItem[] = [];

  for (const template of templates) {
    if (template.is_default) {
      defaultTemplates.push(template);
    } else {
      customTemplates.push(template);
    }
  }

  return { defaultTemplates, customTemplates };
}
