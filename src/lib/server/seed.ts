import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { opportunityScore } from "@/lib/score";
import { studioAuth } from "./studio-auth";
import { nid } from "./access";

function day(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} 06:10`;
}

type SeedKw = {
  seed: string;
  keyword: string;
  volume: number;
  msv: number[];
  kd: number;
  cpc: number;
  ppc: number;
  status: string;
  notes: string;
  agent: string;
  ranks: number[];
  url: string;
};

async function insertProject(
  sql: Awaited<ReturnType<typeof getSql>>,
  ownerId: string,
  meta: {
    name: string;
    domain: string;
    locationId: number;
    languageId: number;
    competitors: string;
    notes: string;
  },
  keywords: SeedKw[],
) {
  const id = nid();
  await sql`
    insert into projects (id, owner_id, name, domain, location_id, language_id, competitors, notes)
    values (${id}, ${ownerId}, ${meta.name}, ${meta.domain}, ${meta.locationId}, ${meta.languageId}, ${meta.competitors}, ${meta.notes})
  `;
  for (const k of keywords) {
    const opp = opportunityScore(k.volume, k.kd, k.ppc);
    await sql`
      insert into keywords (
        id, project_id, seed, keyword, location_id, language_id, volume, msv, kd, cpc, ppc,
        opportunity, status, notes, agent, last_fetched
      ) values (
        ${nid()}, ${id}, ${k.seed}, ${k.keyword}, ${meta.locationId}, ${meta.languageId},
        ${k.volume}, ${JSON.stringify(k.msv)}, ${k.kd}, ${k.cpc}, ${k.ppc}, ${opp},
        ${k.status}, ${k.notes}, ${k.agent}, ${day(0)}
      )
    `;
    const series = k.ranks;
    for (let i = 0; i < series.length; i++) {
      const rank = series[i]!;
      const prev = i === 0 ? rank : series[i - 1]!;
      const best = Math.min(...series.slice(0, i + 1));
      const offset = (series.length - 1 - i) * 7;
      await sql`
        insert into rank_history (id, project_id, keyword, device, rank, prev, best, visits, volume, url, checked_at)
        values (
          ${nid()}, ${id}, ${k.keyword}, 'desktop', ${rank}, ${prev}, ${best},
          ${Math.round(k.volume * (rank <= 10 ? 0.09 : 0.015))}, ${k.volume}, ${k.url}, ${day(offset)}
        )
      `;
    }
  }
  return id;
}

export const seedSampleStudio = createServerFn({ method: "POST" })
  .middleware([studioAuth])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const existing = await sql<{ id: string; domain: string }>`
      select id, domain from projects
      where owner_id = ${context.userId}
        and domain in ('northline.studio', 'drbastaninejad.com')
    `;
    if (existing.length >= 2) return { ids: existing.map((e) => e.id), already: true };

    const ids: string[] = [];
    if (!existing.some((e) => e.domain === "northline.studio")) {
      ids.push(
        await insertProject(
          sql,
          context.userId,
          {
            name: "Northline",
            domain: "northline.studio",
            locationId: 2840,
            languageId: 1000,
            competitors: "riteintherain.com, fieldnotesbrand.com",
            notes: "Outdoor stationery · US catalog",
          },
          [
            {
              seed: "field notebook",
              keyword: "waterproof field notebook",
              volume: 2400,
              msv: [1800, 1900, 2100, 2000, 2200, 2300, 2500, 2600, 2400, 2200, 2100, 2400],
              kd: 18,
              cpc: 1.42,
              ppc: 22,
              status: "tracked",
              notes: "Hero product term.",
              agent: "Assessor",
              ranks: [14, 12, 11, 9, 8, 7, 7, 6],
              url: "https://northline.studio/notebooks/field",
            },
            {
              seed: "field notebook",
              keyword: "best hiking journal",
              volume: 1900,
              msv: [1400, 1500, 1600, 1700, 1800, 2100, 2400, 2200, 1900, 1700, 1600, 1900],
              kd: 27,
              cpc: 0.88,
              ppc: 31,
              status: "briefed",
              notes: "Roundup intent.",
              agent: "Brief",
              ranks: [28, 24, 22, 19, 18, 16, 15, 14],
              url: "https://northline.studio/guides/hiking-journal",
            },
            {
              seed: "field notebook",
              keyword: "rugged pocket notebook",
              volume: 880,
              msv: [720, 740, 760, 800, 820, 860, 900, 920, 880, 840, 800, 880],
              kd: 14,
              cpc: 1.05,
              ppc: 18,
              status: "tracked",
              notes: "Easy win.",
              agent: "Scout",
              ranks: [21, 18, 15, 12, 11, 9, 8, 8],
              url: "https://northline.studio/notebooks/pocket",
            },
            {
              seed: "field notebook",
              keyword: "surveyor field book",
              volume: 1300,
              msv: [1200, 1250, 1280, 1300, 1320, 1290, 1270, 1260, 1280, 1310, 1300, 1300],
              kd: 22,
              cpc: 2.18,
              ppc: 35,
              status: "tracked",
              notes: "B2B adjacent.",
              agent: "Rival",
              ranks: [22, 20, 18, 16, 15, 14, 14, 14],
              url: "https://northline.studio/notebooks/survey",
            },
            {
              seed: "field notebook",
              keyword: "geology field notebook",
              volume: 480,
              msv: [450, 460, 470, 480, 490, 500, 510, 500, 480, 470, 460, 480],
              kd: 9,
              cpc: 0.63,
              ppc: 12,
              status: "briefed",
              notes: "Niche, loyal searchers.",
              agent: "Brief",
              ranks: [18, 15, 12, 9, 7, 5, 4, 4],
              url: "https://northline.studio/journal/geology",
            },
            {
              seed: "trail map",
              keyword: "printable trail log",
              volume: 590,
              msv: [400, 420, 480, 520, 560, 610, 680, 640, 600, 540, 500, 590],
              kd: 11,
              cpc: 0.41,
              ppc: 9,
              status: "new",
              notes: "Lead-magnet candidate.",
              agent: "Scout",
              ranks: [],
              url: "",
            },
          ],
        ),
      );
    }
    if (!existing.some((e) => e.domain === "drbastaninejad.com")) {
      ids.push(
        await insertProject(
          sql,
          context.userId,
          {
            name: "کلینیک بستانی‌نژاد",
            domain: "drbastaninejad.com",
            locationId: 2364,
            languageId: 1000,
            competitors: "drshariati.com, enttehran.com",
            notes: "کلینیک گوش و حلق و بینی · تهران",
          },
          [
            {
              seed: "جراحی بینی",
              keyword: "جراحی بینی تهران",
              volume: 5400,
              msv: [4200, 4300, 4500, 4700, 4900, 5100, 5400, 5600, 5400, 5200, 5000, 5400],
              kd: 36,
              cpc: 0.92,
              ppc: 48,
              status: "tracked",
              notes: "کلمه اصلی خدمات.",
              agent: "Assessor",
              ranks: [19, 16, 14, 12, 11, 9, 8, 7],
              url: "https://drbastaninejad.com/rhinoplasty",
            },
            {
              seed: "جراحی بینی",
              keyword: "متخصص گوش حلق بینی",
              volume: 2900,
              msv: [2400, 2500, 2600, 2700, 2800, 2900, 3100, 3000, 2800, 2700, 2600, 2900],
              kd: 22,
              cpc: 0.71,
              ppc: 33,
              status: "tracked",
              notes: "برند + خدمات.",
              agent: "Expander",
              ranks: [11, 10, 9, 8, 8, 6, 5, 5],
              url: "https://drbastaninejad.com/",
            },
            {
              seed: "جراحی بینی",
              keyword: "انحراف تیغه بینی",
              volume: 1600,
              msv: [1400, 1450, 1500, 1550, 1600, 1700, 1800, 1750, 1650, 1580, 1520, 1600],
              kd: 14,
              cpc: 0.54,
              ppc: 21,
              status: "briefed",
              notes: "قصد درمانی مشخص.",
              agent: "Brief",
              ranks: [24, 21, 18, 16, 14, 12, 11, 10],
              url: "https://drbastaninejad.com/septoplasty",
            },
            {
              seed: "آپنه خواب",
              keyword: "درمان آپنه خواب",
              volume: 880,
              msv: [700, 720, 740, 780, 820, 860, 900, 920, 880, 840, 800, 880],
              kd: 17,
              cpc: 0.66,
              ppc: 19,
              status: "tracked",
              notes: "خوشه محتوای جدید.",
              agent: "Scout",
              ranks: [31, 28, 25, 22, 20, 18, 17, 16],
              url: "https://drbastaninejad.com/sleep-apnea",
            },
            {
              seed: "آپنه خواب",
              keyword: "بهترین جراح بینی در تهران",
              volume: 2100,
              msv: [1800, 1850, 1900, 1950, 2000, 2100, 2300, 2200, 2100, 2000, 1900, 2100],
              kd: 41,
              cpc: 1.12,
              ppc: 55,
              status: "new",
              notes: "رقابت برندمحور.",
              agent: "Rival",
              ranks: [],
              url: "",
            },
          ],
        ),
      );
    }

    const north = ids[0] ?? existing.find((e) => e.domain === "northline.studio")?.id;
    if (north) {
      const hasBrief = await sql<{ id: string }>`select id from briefs where project_id = ${north} limit 1`;
      if (!hasBrief.length) {
        await sql`
          insert into briefs (id, project_id, keyword, content)
          values (
            ${nid()}, ${north}, 'geology field notebook',
            ${"# Geology field notebook\n\nIntent: commercial-investigation. Outline: paper stock, binding, weather resistance, who it's for (students, survey). Answer: write-in-rain vs stone paper. Internal links: /notebooks/field, /guides/packing."}
          )
        `;
        await sql`
          insert into competitors (id, project_id, domain, keyword, volume, kd, cpc, position)
          values
            (${nid()}, ${north}, 'riteintherain.com', 'all weather notebook', 8100, 61, 1.12, 1),
            (${nid()}, ${north}, 'fieldnotesbrand.com', 'pocket notebook', 12100, 54, 0.66, 2)
        `;
        await sql`
          insert into gaps (id, project_id, keyword, volume, cpc, your_position, competitor, competitor_position)
          values
            (${nid()}, ${north}, 'forestry field book', 540, 1.55, 28, 'riteintherain.com', 2),
            (${nid()}, ${north}, 'waterproof lab notebook', 410, 2.3, null, 'riteintherain.com', 3)
        `;
        await sql`
          insert into serp_rows (id, project_id, keyword, position, url, title, domain, kd, features, fetched_at)
          values
            (${nid()}, ${north}, 'waterproof field notebook', 6, 'https://northline.studio/notebooks/field', 'Waterproof field notebook — Northline', 'northline.studio', 18, 'sitelinks', ${day(0)}),
            (${nid()}, ${north}, 'waterproof field notebook', 1, 'https://www.riteintherain.com/', 'Rite in the Rain', 'riteintherain.com', 61, 'ads, sitelinks', ${day(0)})
        `;
      }
    }

    const clinicId =
      existing.find((e) => e.domain === "drbastaninejad.com")?.id ??
      (existing.some((e) => e.domain === "northline.studio") ? ids[0] : ids[1]);
    if (clinicId && clinicId !== north) {
      const hasBrief = await sql<{ id: string }>`select id from briefs where project_id = ${clinicId} limit 1`;
      if (!hasBrief.length) {
        await sql`
          insert into briefs (id, project_id, keyword, content)
          values (
            ${nid()}, ${clinicId}, 'انحراف تیغه بینی',
            ${"# بریف: انحراف تیغه بینی\n\nقصد جستجو: درمانی-تحقیقی.\nH2: علائم انحراف تیغه بینی · تفاوت با زیبایی · روند جراحی در تهران · مراقبت بعد از عمل.\nسوالات: آیا بدون جراحی درمان می‌شود؟ دوره نقاهت چقدر است؟\nلینک داخلی: /rhinoplasty ، /."}
          )
        `;
      }
    }

    return { ids: [...existing.map((e) => e.id), ...ids], already: false };
  });
