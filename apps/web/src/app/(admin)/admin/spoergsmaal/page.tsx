import { api } from "@/lib/api/api.server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { QuestionPanel } from "@/components/admin/question-panel";

export default async function AdminQuestionsPage() {
  const [questions, categories] = await Promise.all([
    api.questions.list({ limit: 100, sort: "sortOrder" }),
    api.categories.list({ limit: 100, sort: "sortOrder" }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Spørgsmål"
        description="Det anmelderne bliver spurgt om ud over stjernerne. Tilføjer du et nyt, ændres gamle anmeldelser ikke — de har bare ikke besvaret det."
        breadcrumb={[{ href: "/admin", label: "Overblik" }]}
      />
      <QuestionPanel questions={questions.items} categories={categories.items} />
    </>
  );
}
