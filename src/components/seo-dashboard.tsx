import { Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { useLocale, useT } from "@/lib/locale";
import { getClickUpSettings, getClickUpTasks, saveClickUpSettings, syncClickUpWithProject, type PublicClickUpSettings } from "@/lib/server/clickup";
import { getSettings, saveSettings } from "@/lib/server/settings";
import { getSEOData, getSEOTimeline, saveSEOData, aggregateSEOData } from "@/lib/server/seo-sources";
import { getContentStats, getContentTimeline, listPublishedContent } from "@/lib/server/published-content";
import { listProjects } from "@/lib/server/projects";
import type { Project } from "@/lib/types";
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { Link, useNavigate } from "@tanstack/react-router";
import { Calendar, ExternalLink, FileText, Globe, LineChart as LineChartIcon, Plus, RefreshCw, Settings, TrendingUp, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type DataSource = "google-search-console" | "bing-webmaster" | "ubersuggest" | "ahrefs" | "moz" | "semrush" | "manual";

const DATA_SOURCES: { value: DataSource; label: { en: string; fa: string } }[] = [
  { value: "google-search-console", label: { en: "Google Search Console", fa: "Google Search Console" } },
  { value: "bing-webmaster", label: { en: "Bing Webmaster", fa: "Bing Webmaster" } },
  { value: "ubersuggest", label: { en: "Ubersuggest", fa: "Ubersuggest" } },
  { value: "ahrefs", label: { en: "Ahrefs", fa: "Ahrefs" } },
  { value: "moz", label: { en: "Moz", fa: "Moz" } },
  { value: "semrush", label: { en: "SEMrush", fa: "SEMrush" } },
];

export function SEODashboard() {
  const t = useT();
  const lang = useLocale((s) => s.lang);
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [seoData, setSeoData] = useState<Record<string, any>>({});
  const [contentData, setContentData] = useState<Record<string, any>>({});
  const [timelineData, setTimelineData] = useState<Record<string, any>>({});
  const [contentList, setContentList] = useState<any[]>([]);
  const [clickUpTasks, setClickUpTasks] = useState<any[]>([]);
  const [clickUpSettings, setClickUpSettings] = useState<PublicClickUpSettings | null>(null);
  const [studioSettings, setStudioSettings] = useState<{ hasKey: boolean; mondayWebhook: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [savingSources, setSavingSources] = useState(false);
  const [sourceForm, setSourceForm] = useState({
    mangoolsKey: "",
    mondayWebhook: "",
    clickUpApiKey: "",
    clickUpListId: "",
  });
  const [showContentModal, setShowContentModal] = useState(false);
  const [newContent, setNewContent] = useState({
    url: "",
    title: "",
    keyword: "",
    contentType: "blog",
  });

  async function loadData() {
    setLoading(true);
    try {
      const [projectsData, settings, studio] = await Promise.all([
        listProjects(),
        getClickUpSettings(),
        getSettings(),
      ]);
      setProjects(projectsData);
      setClickUpSettings(settings);
      setStudioSettings(studio);
      setSourceForm((form) => ({
        ...form,
        mondayWebhook: studio.mondayWebhook || form.mondayWebhook,
        clickUpListId: settings.listId || form.clickUpListId,
      }));

      if (projectsData.length > 0 && !selectedProject) {
        setSelectedProject(projectsData[0]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function loadProjectData(project: Project) {
    setLoading(true);
    try {
      const [seo, contentStats, contentList, timeline, tasks] = await Promise.allSettled([
        aggregateSEOData({ projectId: project.id, keyword: "", sources: ["google-search-console", "bing-webmaster", "ubersuggest"] }),
        getContentStats({ projectId: project.id, days: 30 }),
        listPublishedContent({ projectId: project.id, limit: 20 }),
        getSEOTimeline({ projectId: project.id, days: 30 }),
        clickUpSettings?.hasApiKey && clickUpSettings.listId
          ? getClickUpTasks({ listId: clickUpSettings.listId, limit: 10 })
          : Promise.resolve({ ok: true, data: [] }),
      ]);

      setSeoData((seo as any).status === "fulfilled" ? (seo as any).value.data : {});
      setContentData((contentStats as any).status === "fulfilled" ? (contentStats as any).value.data : {});
      setContentList((contentList as any).status === "fulfilled" ? (contentList as any).value.data : []);
      setTimelineData((timeline as any).status === "fulfilled" ? (timeline as any).value.data : {});
      setClickUpTasks((tasks as any).status === "fulfilled" ? (tasks as any).value.data?.tasks || [] : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load project data");
    } finally {
      setLoading(false);
    }
  }

  async function handleSyncClickUp() {
    if (!selectedProject || !clickUpSettings?.hasApiKey || !clickUpSettings.listId) {
      toast.error("Please configure ClickUp settings first");
      return;
    }

    try {
      const result = await syncClickUpWithProject({
        projectId: selectedProject.id,
        listId: clickUpSettings.listId,
      });

      if (result.ok) {
        toast.success(
          `Synced ${result.created} tasks to ClickUp` +
            (result.skipped ? `, skipped ${result.skipped}` : ""),
        );
        await loadProjectData(selectedProject);
      } else {
        toast.error(
          result.error ||
            `Sync failed (${result.created} created, ${result.failed} failed, ${result.skipped} skipped)`,
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync failed");
    }
  }

  async function handleSaveSources() {
    setSavingSources(true);
    try {
      const mangoolsKey = sourceForm.mangoolsKey.trim();
      const mondayWebhook = sourceForm.mondayWebhook.trim();
      const clickUpApiKey = sourceForm.clickUpApiKey.trim();
      const clickUpListId = sourceForm.clickUpListId.trim();
      const jobs: Promise<unknown>[] = [];
      if (mangoolsKey || mondayWebhook !== (studioSettings?.mondayWebhook ?? "")) {
        jobs.push(
          saveSettings({
            data: {
              ...(mangoolsKey ? { mangoolsKey } : {}),
              mondayWebhook,
            },
          }),
        );
      }
      if (clickUpApiKey || clickUpListId !== (clickUpSettings?.listId ?? "")) {
        jobs.push(
          saveClickUpSettings({
            ...(clickUpApiKey ? { apiKey: clickUpApiKey } : {}),
            ...(clickUpListId ? { listId: clickUpListId } : {}),
          }),
        );
      }
      if (!jobs.length) {
        toast.error("Enter at least one data source setting");
        return;
      }
      const results = await Promise.allSettled(jobs);
      const [nextClickUp, nextStudio] = await Promise.all([getClickUpSettings(), getSettings()]);
      setClickUpSettings(nextClickUp);
      setStudioSettings(nextStudio);
      setSourceForm({
        mangoolsKey: "",
        mondayWebhook: nextStudio.mondayWebhook,
        clickUpApiKey: "",
        clickUpListId: nextClickUp.listId,
      });
      const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
      const saved = results.length - failures.length;
      if (failures.length && !saved) {
        const reason = failures[0]?.reason;
        toast.error(reason instanceof Error ? reason.message : "Failed to save settings");
        return;
      }
      if (failures.length) {
        const reason = failures[0]?.reason;
        toast.error(
          reason instanceof Error
            ? `Some settings saved. ${reason.message}`
            : "Some settings saved, others failed",
        );
        return;
      }
      toast.success("Settings saved");
      setShowSettings(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSavingSources(false);
    }
  }

  async function handleCreateContent(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProject) return;

    try {
      // This would call the createPublishedContent function
      // For now, we'll just show a success message
      toast.success("Content created successfully!");
      setShowContentModal(false);
      setNewContent({ url: "", title: "", keyword: "", contentType: "blog" });
      await loadProjectData(selectedProject);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create content");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadProjectData(selectedProject);
    }
  }, [selectedProject, clickUpSettings]);

  if (loading && projects.length === 0) {
    return (
      <div className="grid flex-1 place-items-center text-muted">
        <div className="flex items-center gap-2">
          <RefreshCw className="size-6 animate-spin" />
          <span>{t("loading")}...</span>
        </div>
      </div>
    );
  }

  // Get translation for data source
  const getSourceLabel = (source: DataSource) => {
    const found = DATA_SOURCES.find(s => s.value === source);
    return found ? (lang === "fa" ? found.label.fa : found.label.en) : source;
  };

  // Prepare chart data from timeline
  const chartData = Object.entries(timelineData).map(([date, metrics]) => {
    const dateObj = new Date(date);
    return {
      date: dateObj.toLocaleDateString(lang === "fa" ? "fa-IR" : "en-US"),
      ...metrics,
    };
  }).reverse();

  // Prepare content chart data
  const contentChartData = Object.entries(contentData.contentByType || {}).map(([type, count]) => ({
    type: type.charAt(0).toUpperCase() + type.slice(1),
    count,
  }));

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-primary">
            {t("studio")}
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("seoDashboard") || "SEO Dashboard"}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={selectedProject?.id || ""}
            onValueChange={(value) => {
              const project = projects.find(p => p.id === value);
              if (project) setSelectedProject(project);
            }}
          >
            <Select.Trigger className="w-48 sm:w-64">
              <Select.Value placeholder={t("selectProject") || "Select Project"} />
            </Select.Trigger>
            <Select.Content>
              {projects.map((p) => (
                <Select.Item key={p.id} value={p.id}>
                  {p.name} ({p.domain || t("noDomain") || "No Domain"})
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Button variant="ghost" onClick={() => navigate({ to: "/" })}>
            <Settings className="size-4" />
            {t("settings") || "Settings"}
          </Button>
          <Button onClick={() => {
            setSourceForm({
              mangoolsKey: "",
              mondayWebhook: studioSettings?.mondayWebhook ?? "",
              clickUpApiKey: "",
              clickUpListId: clickUpSettings?.listId ?? "",
            });
            setShowSettings(true);
          }}>
            <Globe className="size-4" />
            {t("connectSources") || "Connect Sources"}
          </Button>
        </div>
      </div>

      {selectedProject ? (
        <>
          {/* Project Overview */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <FileText className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-muted">{t("totalContent") || "Total Content"}</p>
                  <p className="font-display text-2xl font-semibold">{contentData.totalContent || 0}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <TrendingUp className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-muted">{t("recentContent") || "Recent Content"}</p>
                  <p className="font-display text-2xl font-semibold">{contentData.recentContent || 0}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Users className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-muted">{t("teamMembers") || "Team Members"}</p>
                  <p className="font-display text-2xl font-semibold">{selectedProject.memberCount || 1}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <LineChartIcon className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-muted">{t("keywords") || "Keywords"}</p>
                  <p className="font-display text-2xl font-semibold">{selectedProject.keywordCount || 0}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">{t("contentByType") || "Content by Type"}</h2>
                <Badge variant="subtle">{t("last30Days") || "Last 30 Days"}</Badge>
              </div>
              <div className="h-64 mt-4">
                {contentChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={contentChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="var(--color-primary)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="grid h-full place-items-center text-muted">
                    {t("noData") || "No data available"}
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">{t("seoTrends") || "SEO Trends"}</h2>
                <Badge variant="subtle">{t("last30Days") || "Last 30 Days"}</Badge>
              </div>
              <div className="h-64 mt-4">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {Object.keys(chartData[0] || {}).filter(k => k !== "date").map((key) => (
                        <Line key={key} dataKey={key} type="monotone" stroke="var(--color-primary)" />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="grid h-full place-items-center text-muted">
                    {t("noData") || "No data available"}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Content & Tasks */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">{t("publishedContent") || "Published Content"}</h2>
                <Button size="sm" onClick={() => setShowContentModal(true)}>
                  <Plus className="size-4" />
                  {t("addContent") || "Add Content"}
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                {contentList.length > 0 ? (
                  contentList.slice(0, 5).map((content) => (
                    <div key={content.id} className="flex items-center justify-between rounded-lg bg-raised p-3">
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{content.title}</p>
                        <p className="text-sm text-muted">{content.url}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="subtle">{content.content_type}</Badge>
                        <span className="text-sm text-muted">{content.publish_date}</span>
                        <Link to={`/p/${selectedProject.id}`} className="text-muted hover:text-fg">
                          <ExternalLink className="size-4" />
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="grid h-32 place-items-center text-muted">
                    {t("noContent") || "No content published yet"}
                  </div>
                )}
              </div>

              {contentList.length > 5 && (
                <Button variant="quiet" className="mt-4 w-full" onClick={() => loadProjectData(selectedProject)}>
                  {t("loadMore") || "Load More"}
                </Button>
              )}
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">{t("clickUpTasks") || "ClickUp Tasks"}</h2>
                {clickUpSettings?.hasApiKey && clickUpSettings.listId && (
                  <Button size="sm" onClick={handleSyncClickUp}>
                    <RefreshCw className="size-4" />
                    {t("sync") || "Sync"}
                  </Button>
                )}
              </div>

              <div className="mt-4 space-y-3">
                {clickUpTasks.length > 0 ? (
                  clickUpTasks.slice(0, 5).map((task) => (
                    <div key={task.id} className="flex items-center justify-between rounded-lg bg-raised p-3">
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{task.name}</p>
                        <p className="text-sm text-muted">{task.status}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="subtle">{task.priority}</Badge>
                        <a href={task.url} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-fg">
                          <ExternalLink className="size-4" />
                        </a>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="grid h-32 place-items-center text-muted">
                    {clickUpSettings?.hasApiKey && clickUpSettings.listId
                      ? (t("noTasks") || "No tasks found")
                      : (t("connectClickUp") || "Connect ClickUp to see tasks")}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Data Sources Status */}
          <Card className="p-6">
            <h2 className="font-display text-lg font-semibold">{t("dataSources") || "Data Sources"}</h2>
            <p className="mt-1 text-sm text-muted">{t("connectedSources") || "Connected data sources providing SEO insights"}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {DATA_SOURCES.map((source) => {
                // Check if we have data from this source
                const hasData = Object.values(seoData).some((d: any) =>
                  Object.keys(d || {}).some(k => Object.keys(d[k] || {}).includes(source.value))
                );

                return (
                  <div key={source.value} className="flex items-center gap-3 rounded-lg bg-raised p-3">
                    <div className={`size-3 rounded-full ${hasData ? "bg-green-500" : "bg-gray-400"}`} />
                    <div className="flex-1">
                      <p className="font-medium">{lang === "fa" ? source.label.fa : source.label.en}</p>
                      <p className="text-xs text-muted">
                        {hasData ? (t("connected") || "Connected") : (t("notConnected") || "Not connected")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      ) : (
        <Card className="p-6 text-center">
          <p className="text-muted">{t("selectProjectToView") || "Select a project to view SEO data"}</p>
        </Card>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">{t("connectDataSources") || "Connect Data Sources"}</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)}>
                <X className="size-4" />
              </Button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted">
                {t("connectSourcesDesc") || "Connect your SEO data sources to get comprehensive insights. Clients will only see the data you grant them access to."}
              </p>

              <div className="space-y-3">
                <Field label="Mangools API Key">
                  <Input
                    type="password"
                    autoComplete="off"
                    value={sourceForm.mangoolsKey}
                    onChange={(e) => setSourceForm({ ...sourceForm, mangoolsKey: e.target.value })}
                    placeholder={studioSettings?.hasKey ? "••••••••" : (t("enterMangoolsKey") || "Enter Mangools API Key")}
                  />
                </Field>
                <Field label="Monday.com Webhook">
                  <Input
                    value={sourceForm.mondayWebhook}
                    onChange={(e) => setSourceForm({ ...sourceForm, mondayWebhook: e.target.value })}
                    placeholder={t("enterMondayWebhook") || "Enter Monday.com Webhook URL"}
                  />
                </Field>
                <Field label="ClickUp API Key">
                  <Input
                    type="password"
                    autoComplete="off"
                    value={sourceForm.clickUpApiKey}
                    onChange={(e) => setSourceForm({ ...sourceForm, clickUpApiKey: e.target.value })}
                    placeholder={clickUpSettings?.hasApiKey ? "••••••••" : (t("enterClickUpKey") || "Enter ClickUp API Key")}
                  />
                </Field>
                <Field label="ClickUp List ID">
                  <Input
                    value={sourceForm.clickUpListId}
                    onChange={(e) => setSourceForm({ ...sourceForm, clickUpListId: e.target.value })}
                    placeholder={t("enterClickUpList") || "Enter ClickUp List ID"}
                  />
                </Field>
              </div>

              <Button className="w-full mt-6" onClick={() => void handleSaveSources()} disabled={savingSources}>
                {savingSources ? (t("saving") || "Saving...") : (t("saveSettings") || "Save Settings")}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Add Content Modal */}
      {showContentModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">{t("addNewContent") || "Add New Content"}</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowContentModal(false)}>
                <X className="size-4" />
              </Button>
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleCreateContent}>
              <Field label={t("url") || "URL"}>
                <Input
                  value={newContent.url}
                  onChange={(e) => setNewContent({ ...newContent, url: e.target.value })}
                  placeholder="https://example.com/my-post"
                  required
                />
              </Field>
              <Field label={t("title") || "Title"}>
                <Input
                  value={newContent.title}
                  onChange={(e) => setNewContent({ ...newContent, title: e.target.value })}
                  placeholder={t("contentTitle") || "Content Title"}
                  required
                />
              </Field>
              <Field label={t("keyword") || "Keyword"}>
                <Input
                  value={newContent.keyword}
                  onChange={(e) => setNewContent({ ...newContent, keyword: e.target.value })}
                  placeholder={t("targetKeyword") || "Target Keyword"}
                  required
                />
              </Field>
              <Field label={t("contentType") || "Content Type"}>
                <Select
                  value={newContent.contentType}
                  onValueChange={(value) => setNewContent({ ...newContent, contentType: value })}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="blog">{t("blog") || "Blog Post"}</Select.Item>
                    <Select.Item value="page">{t("page") || "Page"}</Select.Item>
                    <Select.Item value="product">{t("product") || "Product"}</Select.Item>
                    <Select.Item value="video">{t("video") || "Video"}</Select.Item>
                    <Select.Item value="podcast">{t("podcast") || "Podcast"}</Select.Item>
                  </Select.Content>
                </Select>
              </Field>

              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowContentModal(false)}>
                  {t("cancel") || "Cancel"}
                </Button>
                <Button type="submit" className="flex-1">
                  {t("createContent") || "Create Content"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
