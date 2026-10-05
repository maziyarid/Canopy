import { Badge, Button, Field, Textarea } from "@/components/ui";
import { attachAmbientDataDomain, readAmbientDataDomain } from "@/lib/ambient-data-domain";
import {
  GOOGLE_ACTION_POLICIES,
  GOOGLE_ROLE_TEMPLATES,
  type GoogleActionKey,
  type GoogleCapability,
  type GoogleProvider,
  type GoogleRoleTemplate,
} from "@/lib/google/google-capabilities";
import {
  activateGoogleWriteConnection,
  cancelPendingGoogleAction,
  createGoogleActionProposal,
  disableGoogleWriteConnection,
  discoverGoogleConnectionResources,
  executeGrantedGoogleAction,
  getGoogleActionWorkspace,
  getGoogleDelegatedAccess,
  removeGoogleCapabilityGrant,
  saveGoogleCapabilityGrant,
  saveGoogleConnectionBindings,
  startGoogleWriteOAuth,
} from "@/lib/server/google-governance";
import { useLocale } from "@/lib/locale";
import { LoaderCircle, Play, RefreshCw, ShieldCheck, Unplug, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ActionWorkspace = Awaited<ReturnType<typeof getGoogleActionWorkspace>>;
type DelegatedAdmin = Awaited<ReturnType<typeof getGoogleDelegatedAccess>>;
type DiscoveredResource = Awaited<ReturnType<typeof discoverGoogleConnectionResources>>[number];

function withScope<T extends Record<string, unknown>>(payload: T) {
  return attachAmbientDataDomain(payload, readAmbientDataDomain());
}

const selectClass =
  "h-10 w-full rounded-md bg-raised px-3 text-sm text-fg shadow-[var(--shadow-border)]";

const CONNECTION_PRESETS: Array<{
  id: string;
  provider: GoogleProvider;
  profileMode: "write" | "admin";
  scopes: string[];
  label: { en: string; fa: string };
  body: { en: string; fa: string };
}> = [
  {
    id: "gsc-write",
    provider: "gsc",
    profileMode: "write",
    scopes: ["https://www.googleapis.com/auth/webmasters"],
    label: { en: "Search Console changes", fa: "تغییرات سرچ کنسول" },
    body: {
      en: "Submit or remove sitemaps and manage authorised Search Console properties.",
      fa: "ثبت یا حذف سایت‌مپ و مدیریت پراپرتی‌های مجاز سرچ کنسول.",
    },
  },
  {
    id: "ga4-write",
    provider: "ga4",
    profileMode: "write",
    scopes: ["https://www.googleapis.com/auth/analytics.edit"],
    label: { en: "GA4 configuration", fa: "تنظیمات GA4" },
    body: {
      en: "Create approved Analytics configuration such as custom dimensions and key events.",
      fa: "ایجاد تنظیمات مجاز آنالیتیکس، مانند ابعاد سفارشی و رویدادهای کلیدی.",
    },
  },
  {
    id: "ga4-admin",
    provider: "ga4",
    profileMode: "admin",
    scopes: ["https://www.googleapis.com/auth/analytics.manage.users"],
    label: { en: "GA4 user access", fa: "دسترسی کاربران GA4" },
    body: {
      en: "Manage GA4 access bindings. Every user-access change requires approval.",
      fa: "مدیریت دسترسی کاربران GA4. هر تغییر دسترسی نیازمند تأیید است.",
    },
  },
  {
    id: "gtm-write",
    provider: "gtm",
    profileMode: "write",
    scopes: [
      "https://www.googleapis.com/auth/tagmanager.edit.containers",
      "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
      "https://www.googleapis.com/auth/tagmanager.publish",
    ],
    label: { en: "Tag Manager workspace", fa: "فضای کاری تگ منیجر" },
    body: {
      en: "Edit workspaces and versions. Publishing is still a separate capability with approval.",
      fa: "ویرایش فضای کاری و نسخه‌ها. انتشار همچنان مجوز جداگانه و تأیید لازم دارد.",
    },
  },
  {
    id: "gtm-admin",
    provider: "gtm",
    profileMode: "admin",
    scopes: ["https://www.googleapis.com/auth/tagmanager.manage.users"],
    label: { en: "Tag Manager user access", fa: "دسترسی کاربران تگ منیجر" },
    body: {
      en: "Manage account permissions. User changes always require approval.",
      fa: "مدیریت مجوزهای حساب. تغییر دسترسی کاربران همیشه نیازمند تأیید است.",
    },
  },
  {
    id: "ads-write",
    provider: "google_ads",
    profileMode: "write",
    scopes: ["https://www.googleapis.com/auth/adwords"],
    label: { en: "Google Ads campaigns", fa: "کمپین‌های گوگل ادز" },
    body: {
      en: "Campaign and budget operations through the separate Google Ads API approval lane.",
      fa: "مدیریت کمپین و بودجه از مسیر جداگانه و تأییدشدهٔ Google Ads API.",
    },
  },
];

const ACTION_LABELS: Record<GoogleActionKey, { en: string; fa: string }> = {
  "gsc.sitemap.submit": { en: "Submit sitemap", fa: "ثبت سایت‌مپ" },
  "gsc.sitemap.delete": { en: "Delete sitemap", fa: "حذف سایت‌مپ" },
  "gsc.site.add": { en: "Add Search Console property", fa: "افزودن پراپرتی سرچ کنسول" },
  "gsc.site.remove": { en: "Remove Search Console property", fa: "حذف پراپرتی سرچ کنسول" },
  "gtm.workspace.create": { en: "Create GTM workspace", fa: "ایجاد فضای کاری GTM" },
  "gtm.tag.create": { en: "Create tag", fa: "ایجاد تگ" },
  "gtm.tag.update": { en: "Update tag", fa: "ویرایش تگ" },
  "gtm.tag.delete": { en: "Delete tag", fa: "حذف تگ" },
  "gtm.version.create": { en: "Create container version", fa: "ساخت نسخهٔ کانتینر" },
  "gtm.version.publish": { en: "Publish container version", fa: "انتشار نسخهٔ کانتینر" },
  "gtm.user.create": { en: "Add GTM user", fa: "افزودن کاربر GTM" },
  "gtm.user.update": { en: "Update GTM user access", fa: "ویرایش دسترسی کاربر GTM" },
  "gtm.user.delete": { en: "Remove GTM user", fa: "حذف کاربر GTM" },
  "ga4.custom_dimension.create": { en: "Create custom dimension", fa: "ایجاد بُعد سفارشی" },
  "ga4.key_event.create": { en: "Create key event", fa: "ایجاد رویداد کلیدی" },
  "ga4.access_binding.create": { en: "Add GA4 user access", fa: "افزودن دسترسی کاربر GA4" },
  "ga4.access_binding.update": { en: "Update GA4 user access", fa: "ویرایش دسترسی کاربر GA4" },
  "ga4.access_binding.delete": { en: "Remove GA4 user access", fa: "حذف دسترسی کاربر GA4" },
  "ads.campaign.create_paused": { en: "Create paused campaign", fa: "ایجاد کمپین در حالت متوقف" },
  "ads.campaign.update": { en: "Update campaign", fa: "ویرایش کمپین" },
  "ads.campaign.enable": { en: "Enable campaign", fa: "فعال‌سازی کمپین" },
  "ads.budget.create": { en: "Create campaign budget", fa: "ایجاد بودجهٔ کمپین" },
  "ads.budget.update": { en: "Update campaign budget", fa: "ویرایش بودجهٔ کمپین" },
};

function examplePayload(action: GoogleActionKey, resourceRef: string) {
  const examples: Record<GoogleActionKey, Record<string, unknown>> = {
    "gsc.sitemap.submit": { sitemapUrl: "https://example.com/sitemap.xml" },
    "gsc.sitemap.delete": { sitemapUrl: "https://example.com/sitemap.xml" },
    "gsc.site.add": {},
    "gsc.site.remove": {},
    "gtm.workspace.create": { name: "Marketing workspace", description: "" },
    "gtm.tag.create": {
      workspacePath: resourceRef + "/workspaces/1",
      tag: { name: "Tag name", type: "html", parameter: [], firingTriggerId: [] },
    },
    "gtm.tag.update": {
      tagPath: resourceRef + "/workspaces/1/tags/1",
      tag: { name: "Tag name", type: "html", parameter: [], firingTriggerId: [] },
    },
    "gtm.tag.delete": { tagPath: resourceRef + "/workspaces/1/tags/1" },
    "gtm.version.create": { workspacePath: resourceRef + "/workspaces/1", name: "Reviewed version", notes: "" },
    "gtm.version.publish": { versionPath: resourceRef + "/versions/1" },
    "gtm.user.create": {
      emailAddress: "member@example.com",
      accountPermission: "user",
      containerAccess: [{ containerId: "1", permission: "edit" }],
    },
    "gtm.user.update": {
      permissionPath: resourceRef + "/user_permissions/1",
      emailAddress: "member@example.com",
      accountPermission: "user",
      containerAccess: [{ containerId: "1", permission: "edit" }],
    },
    "gtm.user.delete": { permissionPath: resourceRef + "/user_permissions/1" },
    "ga4.custom_dimension.create": {
      parameterName: "content_group",
      displayName: "Content group",
      scope: "EVENT",
    },
    "ga4.key_event.create": { eventName: "generate_lead" },
    "ga4.access_binding.create": {
      emailAddress: "member@example.com",
      roles: ["predefinedRoles/viewer"],
    },
    "ga4.access_binding.update": {
      bindingName: resourceRef + "/accessBindings/1",
      roles: ["predefinedRoles/analyst"],
    },
    "ga4.access_binding.delete": { bindingName: resourceRef + "/accessBindings/1" },
    "ads.campaign.create_paused": {
      name: "Search campaign",
      budgetResourceName: resourceRef + "/campaignBudgets/1",
      advertisingChannelType: "SEARCH",
      containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
    },
    "ads.campaign.update": {
      campaignResourceName: resourceRef + "/campaigns/1",
      name: "Updated campaign name",
    },
    "ads.campaign.enable": { campaignResourceName: resourceRef + "/campaigns/1" },
    "ads.budget.create": { name: "Campaign budget", amountMicros: 1000000 },
    "ads.budget.update": {
      budgetResourceName: resourceRef + "/campaignBudgets/1",
      amountMicros: 1000000,
    },
  };
  return JSON.stringify(examples[action], null, 2);
}

function statusTone(status: string) {
  if (["active", "ready", "succeeded"].includes(status)) return "good" as const;
  if (["pending", "pending_approval", "executing"].includes(status)) return "warn" as const;
  if (["failed", "error", "rejected"].includes(status)) return "bad" as const;
  return "muted" as const;
}

export function GoogleAccessPanel({ projectId }: { projectId: string }) {
  const lang = useLocale((state) => state.lang);
  const [workspace, setWorkspace] = useState<ActionWorkspace | null>(null);
  const [admin, setAdmin] = useState<DelegatedAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [discoveries, setDiscoveries] = useState<Record<string, DiscoveredResource[]>>({});
  const [selectedBindings, setSelectedBindings] = useState<Record<string, string[]>>({});
  const [principalId, setPrincipalId] = useState("");
  const [roleTemplate, setRoleTemplate] = useState<GoogleRoleTemplate>("marketing_editor");
  const [grantProfileId, setGrantProfileId] = useState("");
  const [grantResourceKey, setGrantResourceKey] = useState("");
  const [actionKey, setActionKey] = useState("");
  const [payloadText, setPayloadText] = useState("{}");

  const ui = lang === "fa"
    ? {
        title: "دسترسی و اقدامات گوگل",
        body: "دسترسی هر فرد به حساب و منبع مشخص محدود می‌شود. داشتن نقش در پروژه به‌تنهایی هیچ مجوز نوشتنی در گوگل ایجاد نمی‌کند.",
        myAccess: "دسترسی‌های من",
        noGrant: "برای این حساب هنوز مجوز عملیاتی گوگل ثبت نشده است.",
        actions: "اقدامات مجاز",
        action: "اقدام",
        resource: "منبع",
        details: "جزئیات اقدام",
        detailsHint: "فقط داده‌های لازم برای همین اقدام را وارد کنید. شناسهٔ منبع باید با دسترسی ثبت‌شده مطابقت داشته باشد.",
        run: "اجرا",
        requestApproval: "درخواست تأیید",
        history: "درخواست‌های اخیر",
        cancel: "لغو درخواست",
        ownerTitle: "مدیریت دسترسی تیم",
        connectTitle: "اتصال حساب برای دسترسی نوشتنی",
        connectBody: "توکن در مرورگر ذخیره نمی‌شود. پس از اتصال، فقط منابعی که همین حساب واقعاً به آن‌ها دسترسی دارد قابل انتخاب هستند.",
        connect: "اتصال",
        reconnect: "اتصال دوباره",
        profiles: "اتصال‌های گوگل",
        discover: "بررسی منابع",
        saveResources: "ذخیره منابع",
        activate: "فعال‌سازی اتصال",
        disable: "غیرفعال‌سازی",
        grants: "مجوزهای اعطاشده",
        grantTitle: "اعطای مجوز",
        person: "فرد",
        role: "الگوی دسترسی",
        connection: "اتصال",
        grant: "اعطای مجوزهای این نقش",
        noCompatible: "برای این نقش و منبع، مجوز سازگاری وجود ندارد.",
        awaiting: "در انتظار تأیید",
        queued: "درخواست برای تأیید ارسال شد.",
        approvalUnavailable: "درخواست ذخیره شد، اما مسیر تأیید فعلاً در دسترس نیست.",
        executed: "اقدام با موفقیت اجرا شد.",
        connected: "پس از تأیید گوگل به همین پروژه برمی‌گردید.",
        resourcesEmpty: "منبعی با این حساب پیدا نشد.",
        selectResources: "منابع مجاز این اتصال را انتخاب کنید.",
      }
    : {
        title: "Google access & actions",
        body: "Every person is limited to explicit Google resources and capabilities. A project role alone never grants Google write access.",
        myAccess: "My access",
        noGrant: "No operational Google capability has been granted to this account yet.",
        actions: "Allowed actions",
        action: "Action",
        resource: "Resource",
        details: "Action details",
        detailsHint: "Provide only the fields required for this action. Resource identifiers must match the bound access.",
        run: "Run action",
        requestApproval: "Request approval",
        history: "Recent requests",
        cancel: "Cancel request",
        ownerTitle: "Team access management",
        connectTitle: "Connect an account for write access",
        connectBody: "Tokens are never stored in the browser. After OAuth, only resources actually visible to that identity can be bound.",
        connect: "Connect",
        reconnect: "Reconnect",
        profiles: "Google connections",
        discover: "Discover resources",
        saveResources: "Save resources",
        activate: "Activate connection",
        disable: "Disable",
        grants: "Granted capabilities",
        grantTitle: "Grant access",
        person: "Person",
        role: "Access template",
        connection: "Connection",
        grant: "Grant this template",
        noCompatible: "This role has no compatible capability for the selected resource.",
        awaiting: "Awaiting approval",
        queued: "Approval request queued.",
        approvalUnavailable: "The request was saved, but the approval path is currently unavailable.",
        executed: "Action completed.",
        connected: "You will return to this project after Google authorisation.",
        resourcesEmpty: "No resource was discovered for this identity.",
        selectResources: "Choose which discovered resources this connection may control.",
      };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const actionState = await getGoogleActionWorkspace({ data: withScope({ projectId }) });
      setWorkspace(actionState);
      if (actionState.canManageDelegatedAccess) {
        setAdmin(await getGoogleDelegatedAccess({ data: withScope({ projectId }) }));
      } else {
        setAdmin(null);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google access unavailable");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!workspace?.actions.length) {
      setActionKey("");
      setPayloadText("{}");
      return;
    }
    const stillExists = workspace.actions.some(
      (item) => item.action + "\n" + item.resourceRef === actionKey,
    );
    if (!stillExists) {
      const first = workspace.actions[0];
      setActionKey(first.action + "\n" + first.resourceRef);
      setPayloadText(examplePayload(first.action, first.resourceRef));
    }
  }, [workspace, actionKey]);

  useEffect(() => {
    if (!admin) return;
    if (!principalId && admin.principals[0]) setPrincipalId(admin.principals[0].userId);
    const active = admin.profiles.filter((profile) => profile.status === "active");
    if (!grantProfileId && active[0]) setGrantProfileId(active[0].id);
  }, [admin, principalId, grantProfileId]);

  const selectedAction = useMemo(() => {
    if (!workspace || !actionKey) return null;
    return workspace.actions.find((item) => item.action + "\n" + item.resourceRef === actionKey) ?? null;
  }, [workspace, actionKey]);

  const activeProfiles = admin?.profiles.filter((profile) => profile.status === "active") ?? [];
  const grantProfile = activeProfiles.find((profile) => profile.id === grantProfileId) ?? null;
  const grantResources = grantProfile?.resourceBindings ?? [];
  const selectedGrantResource = grantResources.find(
    (resource) => resource.type + "\n" + resource.ref === grantResourceKey,
  ) ?? grantResources[0] ?? null;

  useEffect(() => {
    if (!grantProfile) {
      setGrantResourceKey("");
      return;
    }
    const current = grantProfile.resourceBindings.some(
      (resource) => resource.type + "\n" + resource.ref === grantResourceKey,
    );
    if (!current && grantProfile.resourceBindings[0]) {
      const first = grantProfile.resourceBindings[0];
      setGrantResourceKey(first.type + "\n" + first.ref);
    }
  }, [grantProfile, grantResourceKey]);

  const compatibleCapabilities = useMemo(() => {
    if (!grantProfile || !selectedGrantResource) return [] as GoogleCapability[];
    const roleCapabilities = new Set<GoogleCapability>(GOOGLE_ROLE_TEMPLATES[roleTemplate]);
    const result = new Set<GoogleCapability>();
    for (const policy of Object.values(GOOGLE_ACTION_POLICIES)) {
      if (
        policy.provider === grantProfile.provider &&
        policy.resourceType === selectedGrantResource.type &&
        roleCapabilities.has(policy.capability)
      ) {
        result.add(policy.capability);
      }
    }
    return [...result];
  }, [grantProfile, selectedGrantResource, roleTemplate]);

  async function runBusy<T>(key: string, operation: () => Promise<T>) {
    setBusy(key);
    try {
      return await operation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
      throw error;
    } finally {
      setBusy("");
    }
  }

  if (loading && !workspace) {
    return (
      <div className="grid min-h-56 place-items-center text-muted">
        <LoaderCircle className="size-6 animate-spin" />
      </div>
    );
  }

  if (!workspace) {
    return <p className="rounded-xl bg-bad/10 p-4 text-sm text-bad">Google access unavailable.</p>;
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">{ui.title}</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted">{ui.body}</p>
          </div>
          <Button variant="ghost" size="sm" disabled={loading} onClick={() => void load()}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            {lang === "fa" ? "به‌روزرسانی" : "Refresh"}
          </Button>
        </div>
      </section>

      {workspace.canManageDelegatedAccess && admin ? (
        <OwnerGoogleAccess
          projectId={projectId}
          lang={lang}
          ui={ui}
          admin={admin}
          busy={busy}
          discoveries={discoveries}
          selectedBindings={selectedBindings}
          setDiscoveries={setDiscoveries}
          setSelectedBindings={setSelectedBindings}
          runBusy={runBusy}
          reload={load}
          principalId={principalId}
          setPrincipalId={setPrincipalId}
          roleTemplate={roleTemplate}
          setRoleTemplate={setRoleTemplate}
          grantProfileId={grantProfileId}
          setGrantProfileId={setGrantProfileId}
          grantResourceKey={grantResourceKey}
          setGrantResourceKey={setGrantResourceKey}
          activeProfiles={activeProfiles}
          selectedGrantResource={selectedGrantResource}
          compatibleCapabilities={compatibleCapabilities}
        />
      ) : null}

      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-lg font-semibold">{ui.myAccess}</h2>
        {!workspace.grants.length ? (
          <p className="mt-2 text-sm text-muted">{ui.noGrant}</p>
        ) : (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {workspace.grants.map((grant) => (
              <div key={grant.id} className="rounded-xl bg-raised p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs text-primary">{grant.capability}</span>
                  <Badge tone="good">{grant.provider}</Badge>
                </div>
                <p className="mt-2 break-all text-sm">{grant.resourceRef}</p>
                {grant.expiresAt ? (
                  <p className="mt-1 text-xs text-muted">
                    {lang === "fa" ? "انقضا" : "Expires"}: {new Date(grant.expiresAt).toLocaleString(lang === "fa" ? "fa-IR" : "en-GB")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-lg font-semibold">{ui.actions}</h2>
        {!workspace.actions.length ? (
          <p className="mt-2 text-sm text-muted">{ui.noGrant}</p>
        ) : (
          <form
            className="mt-3 grid gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!selectedAction) return;
              let payload: Record<string, unknown>;
              try {
                const parsed = JSON.parse(payloadText);
                if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                  throw new Error(lang === "fa" ? "جزئیات اقدام باید یک شیء JSON باشد." : "Action details must be a JSON object.");
                }
                payload = parsed as Record<string, unknown>;
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Invalid JSON");
                return;
              }
              try {
                await runBusy("action", async () => {
                  const proposed = await createGoogleActionProposal({
                    data: withScope({
                      projectId,
                      action: selectedAction.action,
                      resourceRef: selectedAction.resourceRef,
                      payload,
                      idempotencyKey: "ui-" + crypto.randomUUID(),
                    }),
                  });
                  if (proposed.approval === "not_required") {
                    await executeGrantedGoogleAction({
                      data: withScope({ projectId, proposalId: proposed.proposal.id }),
                    });
                    toast.success(ui.executed);
                  } else if (proposed.approval === "queued") {
                    toast.success(ui.queued);
                  } else {
                    toast.warning(ui.approvalUnavailable);
                  }
                });
                await load();
              } catch {
                // runBusy already reports the failure.
              }
            }}
          >
            <Field label={ui.action}>
              <select
                className={selectClass}
                value={actionKey}
                onChange={(event) => {
                  const value = event.target.value;
                  setActionKey(value);
                  const match = workspace.actions.find(
                    (item) => item.action + "\n" + item.resourceRef === value,
                  );
                  if (match) setPayloadText(examplePayload(match.action, match.resourceRef));
                }}
              >
                {workspace.actions.map((item) => (
                  <option key={item.action + "\n" + item.resourceRef} value={item.action + "\n" + item.resourceRef}>
                    {ACTION_LABELS[item.action][lang]} · {item.resourceRef}
                  </option>
                ))}
              </select>
            </Field>
            {selectedAction ? (
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge tone={selectedAction.approval === "ada" ? "warn" : "good"}>
                  {selectedAction.approval === "ada" ? ui.awaiting : lang === "fa" ? "اجرای مستقیم با مجوز" : "Grant-authorised"}
                </Badge>
                <Badge>{selectedAction.capability}</Badge>
                <Badge>{selectedAction.mutationType}</Badge>
              </div>
            ) : null}
            <Field label={ui.details} hint={ui.detailsHint}>
              <Textarea
                value={payloadText}
                onChange={(event) => setPayloadText(event.target.value)}
                className="min-h-48 font-mono text-xs"
                dir="ltr"
                spellCheck={false}
              />
            </Field>
            <Button type="submit" className="w-fit" disabled={busy === "action" || !selectedAction}>
              {busy === "action" ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />}
              {selectedAction?.approval === "ada" ? ui.requestApproval : ui.run}
            </Button>
          </form>
        )}
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-lg font-semibold">{ui.history}</h2>
        {!workspace.proposals.length ? (
          <p className="mt-2 text-sm text-muted">{lang === "fa" ? "هنوز درخواستی ثبت نشده است." : "No action request has been recorded yet."}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {workspace.proposals.map((proposal) => (
              <div key={proposal.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-raised p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{ACTION_LABELS[proposal.action][lang]}</p>
                    <Badge tone={statusTone(proposal.status)}>{proposal.status}</Badge>
                  </div>
                  <p className="mt-1 break-all font-mono text-xs text-muted">{proposal.resourceRef}</p>
                  <p className="mt-1 font-mono text-[11px] text-subtle">
                    {proposal.payloadHash.slice(0, 12)}… · {proposal.idempotencyKey}
                  </p>
                </div>
                {["pending_approval", "ready"].includes(proposal.status) ? (
                  <Button
                    size="sm"
                    variant="quiet"
                    disabled={busy === "cancel:" + proposal.id}
                    onClick={async () => {
                      try {
                        await runBusy("cancel:" + proposal.id, () =>
                          cancelPendingGoogleAction({ data: withScope({ projectId, proposalId: proposal.id }) }),
                        );
                        await load();
                      } catch {
                        // runBusy reports.
                      }
                    }}
                  >
                    <X className="size-4" />
                    {ui.cancel}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type OwnerProps = {
  projectId: string;
  lang: "fa" | "en";
  ui: Record<string, string>;
  admin: DelegatedAdmin;
  busy: string;
  discoveries: Record<string, DiscoveredResource[]>;
  selectedBindings: Record<string, string[]>;
  setDiscoveries: React.Dispatch<React.SetStateAction<Record<string, DiscoveredResource[]>>>;
  setSelectedBindings: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  runBusy: <T>(key: string, operation: () => Promise<T>) => Promise<T>;
  reload: () => Promise<void>;
  principalId: string;
  setPrincipalId: (value: string) => void;
  roleTemplate: GoogleRoleTemplate;
  setRoleTemplate: (value: GoogleRoleTemplate) => void;
  grantProfileId: string;
  setGrantProfileId: (value: string) => void;
  grantResourceKey: string;
  setGrantResourceKey: (value: string) => void;
  activeProfiles: DelegatedAdmin["profiles"];
  selectedGrantResource: DelegatedAdmin["profiles"][number]["resourceBindings"][number] | null;
  compatibleCapabilities: GoogleCapability[];
};

function OwnerGoogleAccess(props: OwnerProps) {
  const {
    projectId, lang, ui, admin, busy, discoveries, selectedBindings,
    setDiscoveries, setSelectedBindings, runBusy, reload, principalId, setPrincipalId,
    roleTemplate, setRoleTemplate, grantProfileId, setGrantProfileId,
    grantResourceKey, setGrantResourceKey, activeProfiles, selectedGrantResource,
    compatibleCapabilities,
  } = props;

  return (
    <>
      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">{ui.ownerTitle}</h2>
        </div>
        <div className="mt-4">
          <h3 className="font-medium">{ui.connectTitle}</h3>
          <p className="mt-1 text-sm text-muted">{ui.connectBody}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {CONNECTION_PRESETS.map((preset) => {
              const existing = admin.profiles.find(
                (profile) => profile.provider === preset.provider && profile.profileMode === preset.profileMode,
              );
              return (
                <div key={preset.id} className="rounded-xl bg-raised p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{preset.label[lang]}</p>
                    {existing ? <Badge tone={statusTone(existing.status)}>{existing.status}</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted">{preset.body[lang]}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-3"
                    disabled={busy === "oauth:" + preset.id}
                    onClick={async () => {
                      try {
                        const result = await runBusy("oauth:" + preset.id, () =>
                          startGoogleWriteOAuth({
                            data: withScope({
                              projectId,
                              provider: preset.provider,
                              profileMode: preset.profileMode,
                              scopes: preset.scopes,
                            }),
                          }),
                        );
                        toast.message(ui.connected);
                        window.location.assign(result.authorizationUrl);
                      } catch {
                        // runBusy reports.
                      }
                    }}
                  >
                    {busy === "oauth:" + preset.id ? <LoaderCircle className="size-4 animate-spin" /> : null}
                    {existing ? ui.reconnect : ui.connect}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-lg font-semibold">{ui.profiles}</h2>
        {!admin.profiles.length ? (
          <p className="mt-2 text-sm text-muted">{lang === "fa" ? "هنوز اتصال نوشتنی ثبت نشده است." : "No write-capable connection has been registered yet."}</p>
        ) : (
          <div className="mt-3 grid gap-3">
            {admin.profiles.map((profile) => {
              const discovered = discoveries[profile.id];
              const selected = selectedBindings[profile.id] ?? profile.resourceBindings.map(
                (resource) => resource.type + "\n" + resource.ref,
              );
              return (
                <div key={profile.id} className="rounded-xl bg-raised p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{profile.provider}</p>
                        <Badge>{profile.profileMode}</Badge>
                        <Badge tone={statusTone(profile.status)}>{profile.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted">{profile.scopes.join(" · ")}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === "discover:" + profile.id}
                        onClick={async () => {
                          try {
                            const resources = await runBusy("discover:" + profile.id, () =>
                              discoverGoogleConnectionResources({ data: withScope({ projectId, profileId: profile.id }) }),
                            );
                            setDiscoveries((current) => ({ ...current, [profile.id]: resources }));
                            setSelectedBindings((current) => ({
                              ...current,
                              [profile.id]: profile.resourceBindings.map((resource) => resource.type + "\n" + resource.ref),
                            }));
                            if (!resources.length) toast.message(ui.resourcesEmpty);
                          } catch {
                            // runBusy reports.
                          }
                        }}
                      >
                        {busy === "discover:" + profile.id ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                        {ui.discover}
                      </Button>
                      {profile.status !== "active" && profile.resourceBindings.length ? (
                        <Button
                          size="sm"
                          disabled={busy === "activate:" + profile.id}
                          onClick={async () => {
                            try {
                              await runBusy("activate:" + profile.id, () =>
                                activateGoogleWriteConnection({ data: withScope({ projectId, profileId: profile.id }) }),
                              );
                              await reload();
                            } catch {
                              // reported.
                            }
                          }}
                        >
                          {ui.activate}
                        </Button>
                      ) : null}
                      {profile.status === "active" ? (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy === "disable:" + profile.id}
                          onClick={async () => {
                            try {
                              await runBusy("disable:" + profile.id, () =>
                                disableGoogleWriteConnection({ data: withScope({ projectId, profileId: profile.id }) }),
                              );
                              await reload();
                            } catch {
                              // reported.
                            }
                          }}
                        >
                          <Unplug className="size-4" />
                          {ui.disable}
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {profile.resourceBindings.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {profile.resourceBindings.map((resource) => (
                        <Badge key={resource.type + resource.ref} tone="primary">
                          {resource.type}: {resource.ref}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  {discovered ? (
                    <div className="mt-3 rounded-lg bg-surface p-3">
                      <p className="text-sm font-medium">{ui.selectResources}</p>
                      {!discovered.length ? (
                        <p className="mt-2 text-xs text-muted">{ui.resourcesEmpty}</p>
                      ) : (
                        <div className="mt-2 grid gap-2">
                          {discovered.map((resource) => {
                            const key = resource.type + "\n" + resource.ref;
                            return (
                              <label key={key} className="flex items-start gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  className="mt-1 size-4 accent-primary"
                                  checked={selected.includes(key)}
                                  onChange={() => {
                                    setSelectedBindings((current) => {
                                      const values = current[profile.id] ?? selected;
                                      return {
                                        ...current,
                                        [profile.id]: values.includes(key)
                                          ? values.filter((item) => item !== key)
                                          : [...values, key],
                                      };
                                    });
                                  }}
                                />
                                <span>
                                  <span className="font-medium">{resource.label}</span>
                                  <span className="block break-all font-mono text-xs text-muted">{resource.ref}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                      <Button
                        size="sm"
                        className="mt-3"
                        disabled={!selected.length || busy === "bind:" + profile.id}
                        onClick={async () => {
                          const bindings = discovered
                            .filter((resource) => selected.includes(resource.type + "\n" + resource.ref))
                            .map((resource) => ({ type: resource.type, ref: resource.ref }));
                          if (!bindings.length) return;
                          try {
                            await runBusy("bind:" + profile.id, () =>
                              saveGoogleConnectionBindings({
                                data: withScope({ projectId, profileId: profile.id, bindings }),
                              }),
                            );
                            await reload();
                          } catch {
                            // reported.
                          }
                        }}
                      >
                        {ui.saveResources}
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-4 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-lg font-semibold">{ui.grantTitle}</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label={ui.person}>
            <select className={selectClass} value={principalId} onChange={(event) => setPrincipalId(event.target.value)}>
              {admin.principals.map((principal) => (
                <option key={principal.userId} value={principal.userId}>
                  {principal.label} · {principal.role}
                </option>
              ))}
            </select>
          </Field>
          <Field label={ui.role}>
            <select
              className={selectClass}
              value={roleTemplate}
              onChange={(event) => setRoleTemplate(event.target.value as GoogleRoleTemplate)}
            >
              {Object.keys(GOOGLE_ROLE_TEMPLATES).map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </Field>
          <Field label={ui.connection}>
            <select
              className={selectClass}
              value={grantProfileId}
              onChange={(event) => setGrantProfileId(event.target.value)}
            >
              {activeProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.provider} · {profile.profileMode}
                </option>
              ))}
            </select>
          </Field>
          <Field label={ui.resource}>
            <select
              className={selectClass}
              value={grantResourceKey}
              onChange={(event) => setGrantResourceKey(event.target.value)}
            >
              {(grantProfileId
                ? activeProfiles.find((profile) => profile.id === grantProfileId)?.resourceBindings ?? []
                : []
              ).map((resource) => (
                <option key={resource.type + resource.ref} value={resource.type + "\n" + resource.ref}>
                  {resource.type} · {resource.ref}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {compatibleCapabilities.map((capability) => <Badge key={capability}>{capability}</Badge>)}
          {!compatibleCapabilities.length ? <span className="text-sm text-muted">{ui.noCompatible}</span> : null}
        </div>
        <Button
          className="w-fit"
          disabled={!principalId || !grantProfileId || !selectedGrantResource || !compatibleCapabilities.length || busy === "grant"}
          onClick={async () => {
            if (!selectedGrantResource) return;
            try {
              await runBusy("grant", async () => {
                for (const capability of compatibleCapabilities) {
                  await saveGoogleCapabilityGrant({
                    data: withScope({
                      projectId,
                      principalUserId: principalId,
                      roleTemplate,
                      capability,
                      connectionProfileId: grantProfileId,
                      resourceType: selectedGrantResource.type,
                      resourceRef: selectedGrantResource.ref,
                    }),
                  });
                }
              });
              await reload();
            } catch {
              // reported.
            }
          }}
        >
          <ShieldCheck className="size-4" />
          {ui.grant}
        </Button>
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-lg font-semibold">{ui.grants}</h2>
        {!admin.grants.length ? (
          <p className="mt-2 text-sm text-muted">{lang === "fa" ? "هنوز مجوزی اعطا نشده است." : "No capability has been granted yet."}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {admin.grants.map((grant) => {
              const principal = admin.principals.find((item) => item.userId === grant.principal_user_id);
              return (
                <div key={grant.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-raised p-3">
                  <div>
                    <p className="font-medium">{principal?.label ?? grant.principal_user_id}</p>
                    <p className="mt-1 font-mono text-xs text-muted">{grant.capability}</p>
                    <p className="mt-1 break-all text-xs text-subtle">{grant.resource_ref}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={grant.status === "active" ? "good" : "muted"}>{grant.status}</Badge>
                    {grant.status === "active" ? (
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busy === "revoke:" + grant.id}
                        onClick={async () => {
                          try {
                            await runBusy("revoke:" + grant.id, () =>
                              removeGoogleCapabilityGrant({ data: withScope({ projectId, grantId: grant.id }) }),
                            );
                            await reload();
                          } catch {
                            // reported.
                          }
                        }}
                      >
                        {lang === "fa" ? "لغو مجوز" : "Revoke"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
