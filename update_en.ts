import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

async function updateEn2Cn() {
  const localPath = '/Users/jyking/nextcloud/project/claude2cn/en2cn.json';

  // 使用用户提供的 curl 命令获取最新数据
  const curlCmd = `curl 'https://claude.ai/i18n/en-US.json' \\
  -H 'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7' \\
  -H 'accept-language: en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7' \\
  -H 'cache-control: max-age=0' \\
  -b 'anthropic-device-id=bac1a79e-1051-4cba-a27f-d9db3d11393f; _fbp=fb.1.1771920483878.18063808634192372; ajs_anonymous_id=claudeai.v1.5d0b62de-7fe6-414a-8248-e8187fdde20c; CH-prefers-color-scheme=light; cookie_seed_done=1; __ssid=c77de0df-5467-4349-89af-c4bb01b102cf; __hstc=215430600.70a405a4c80de3982a980c542dff9b73.1771920493239.1771920493239.1771920493239.1; hubspotutk=70a405a4c80de3982a980c542dff9b73; g_state={"i_l":0,"i_ll":1771920490333,"i_e":{"enable_itp_optimization":1}}; sessionKey=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; lastActiveOrg=7430fe19-83cc-43e3-b79f-abdddf52a567; ajs_user_id=c03daf12-4229-49a2-b877-a811b1b29e76; intercom-device-id-lupk8zyo=1f31002c-4f94-4445-8497-76db8bd8354b; app-shell-mode=gate-disabled; _gcl_au=1.1.820992118.1773370690; __stripe_mid=6800b2ed-f871-49ec-94fd-12f96005446ae95eeb; user-sidebar-visible-on-load=true; activitySessionId=4512434a-e70f-4927-b15f-8bed41ff2c23; _cfuvid=8OKY_QstGz_CZnCWTA4mHvhboLjjzBPAiPupBKUVJQM-1773985921265-0.0.1.1-604800000; user-sidebar-pinned=true; cf_clearance=IdsNmwLxRDV8miYz3srVEB5e3DaGb3VqiVdMuwq3apo-1773997687-1.2.1.1-Q9xvADfCRr9CU.D8xbKrAS5pCGbukmGaGYx9ixirwT0niEfBAldlDW2HU6nxBpMteWT92K_PEfQ35TV69inoRPVuH2jLygJHN8gsytSRUZQbn5_MwjjEUCi6WXroduckUE.jtr5xxuav0wU0eIzLS4h9QrsskJ88xbPuLSr7A7FreLAMzczW4Ko7Q_mlyOFyvOQvTbbTcRyYrSgIwJwQGhgrB9tNldI8lXWm01igI_mCUT0CSFEDrjE6vQSJVMe8; intercom-session-lupk8zyo=MllrMjZPa3VxMS84TjBUK2VKWHlmK29ROEg1TVEvS2JGK2s3SnBiUENHV20rVExGc0dWUFNPTUp0SW00S1NZQU03cmU4SnNJYk1VenpVK1pZVFN3cURqU0tGdzBpQmFuRHd0dXBsZC9CRnAyT2NNaWRTWEVIQXJ5cVdvQzNDdEFhVkhRcmVSVklheTFGZW9NS2s2SVloU1F3TFJwQkhKck5nMThUZWU4aTFLMGFoWDY5MjVzNTVod0loTXo3MHlCdlV1L1l5WFhYZ1F4cXAvZEJrdmRKMHlOUlFGenJWNzY5T3VURFlKQ09pcXI0b0Exbk9Ma3VvSjVnRjZWK3pRSVZBSmdHamVTenF3dFlxT05hVEdzQ1ZuVXIvbzl4Rll4Y1lLR1Z3OTkyVEE9LS1JWk1DRmtwaitWVDY3RzFWRWtPN3hRPT0=--ca686e27f64fdb0e65c3d85f69eb5f43f26355db; routingHint=sk-ant-rh-eyJ0eXAiOiAiSldUIiwgImFsZyI6ICJFUzI1NiIsICJraWQiOiAiN0MxcWFPRnhqdWxaUjRFQnNuNk1UeUZGNWdDV2JHbFpNVDR2RklrRFFpbyJ9.eyJzdWIiOiAiYzAzZGFmMTItNDIyOS00OWEyLWI4NzctYTgxMWIxYjI5ZTc2IiwgImlhdCI6IDE3NzM5OTgzNjYsICJpc3MiOiAiY2xhdWRlLWFpLXJvdXRpbmciLCAib25ib2FyZGluZ19jb21wbGV0ZSI6IHRydWUsICJwaG9uZV92ZXJpZmllZCI6IGZhbHNlLCAiYWdlX3ZlcmlmaWVkIjogdHJ1ZSwgIm5hbWUiOiAianlraW5nIiwgImxvY2FsZSI6ICJlbi1VUyJ9.Th8Lby89mpcHsUALhYuXHoDcI6sXOiEb1ZJtgcFIGKhiTWzs66CEG2mFc_Stvcb_plV4NyPb-OYTXQkXLk74mg; _dd_s=aid=8cf867a1-7225-40f1-b04e-ec134fabace7&rum=0&expire=1773999268204; __cf_bm=jj.nvKkqrH13EKHvvBkImZQvsiulTUmGH3R1UfgVL4g-1773998748-1.0.1.1-5hmD4fxWwnfSvLiGjkNTCLpVLV55nGoeOppARrpxoYi_ofb6MV9tJ8SeaMohFH0gFHyVVDaQ8lBUSgMLtzvPpS3gM.DjcSDBaWPI5w0htSU' \\
  -H 'dnt: 1' \\
  -H 'priority: u=0, i' \\
  -H 'sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"' \\
  -H 'sec-ch-ua-arch: "x86"' \\
  -H 'sec-ch-ua-bitness: "64"' \\
  -H 'sec-ch-ua-full-version: "146.0.7680.80"' \\
  -H 'sec-ch-ua-full-version-list: "Chromium";v="146.0.7680.80", "Not-A.Brand";v="24.0.0.0", "Google Chrome";v="146.0.7680.80"' \\
  -H 'sec-ch-ua-mobile: ?0' \\
  -H 'sec-ch-ua-model: ""' \\
  -H 'sec-ch-ua-platform: "macOS"' \\
  -H 'sec-ch-ua-platform-version: "15.4.0"' \\
  -H 'sec-fetch-dest: document' \\
  -H 'sec-fetch-mode: navigate' \\
  -H 'sec-fetch-site: none' \\
  -H 'sec-fetch-user: ?1' \\
  -H 'upgrade-insecure-requests: 1' \\
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'`;

  console.log('🌐 正在通过 curl 获取最新数据...');
  let remoteData;
  try {
    const rawOutput = execSync(curlCmd, { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 10 });
    remoteData = JSON.parse(rawOutput);
    console.log('✅ 远程数据下载并解析成功');
  } catch (error) {
    console.error('❌ 获取或解析远程 JSON 失败:', error);
    return;
  }

  console.log('📂 正在读取本地文件 en2cn.json...');
  if (!fs.existsSync(localPath)) {
    console.error('❌ 错误: 本地文件不存在');
    return;
  }
  const localContent = fs.readFileSync(localPath, 'utf-8');
  let localData = JSON.parse(localContent);

  // 提取远程数据中的所有字符串值
  const remoteValues = new Set<string>();
  function extractValues(obj: any) {
    if (typeof obj === 'string') {
      remoteValues.add(obj);
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        extractValues(obj[key]);
      }
    }
  }

  extractValues(remoteData);
  console.log(`🔍 远程数据中共提取到 ${remoteValues.size} 个唯一值。`);

  let addedCount = 0;
  for (const value of remoteValues) {
    if (!(value in localData)) {
      localData[value] = ""; // 缺失则加入，翻译为空字符串
      addedCount++;
    }
  }

  if (addedCount > 0) {
    console.log(`🚀 共发现 ${addedCount} 个本地不存在的项，正在更新本地文件...`);
    fs.writeFileSync(localPath, JSON.stringify(localData, null, 2), 'utf-8');
    console.log('✨ 更新完成！');
  } else {
    console.log('🎉 没有任何项需要更新，本地已是最新。');
  }
}

updateEn2Cn();
