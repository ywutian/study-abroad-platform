if (!self.define) {
  let e,
    a = {};
  const c = (c, s) => (
    (c = new URL(c + '.js', s).href),
    a[c] ||
      new Promise((a) => {
        if ('document' in self) {
          const e = document.createElement('script');
          ((e.src = c), (e.onload = a), document.head.appendChild(e));
        } else ((e = c), importScripts(c), a());
      }).then(() => {
        let e = a[c];
        if (!e) throw new Error(`Module ${c} didn’t register its module`);
        return e;
      })
  );
  self.define = (s, i) => {
    const n = e || ('document' in self ? document.currentScript.src : '') || location.href;
    if (a[n]) return;
    let t = {};
    const r = (e) => c(e, n),
      d = { module: { uri: n }, exports: t, require: r };
    a[n] = Promise.all(s.map((e) => d[e] || r(e))).then((e) => (i(...e), t));
  };
}
define(['./workbox-2191059d'], function (e) {
  'use strict';
  (importScripts(),
    self.skipWaiting(),
    e.clientsClaim(),
    e.precacheAndRoute(
      [
        {
          url: '/_next/static/5qRybwFqSnY6FEEKT0-1J/_buildManifest.js',
          revision: '0ca8ff526605f72de94e87519a30247e',
        },
        {
          url: '/_next/static/5qRybwFqSnY6FEEKT0-1J/_ssgManifest.js',
          revision: 'b6652df95db52feb4daf4eca35380933',
        },
        { url: '/_next/static/chunks/1110-7ba52f63cb144a70.js', revision: '7ba52f63cb144a70' },
        { url: '/_next/static/chunks/1271-cd13943793393746.js', revision: 'cd13943793393746' },
        { url: '/_next/static/chunks/1547-11feaeebcf0f3e62.js', revision: '11feaeebcf0f3e62' },
        { url: '/_next/static/chunks/1611-7ee5c66c270e9faa.js', revision: '7ee5c66c270e9faa' },
        { url: '/_next/static/chunks/1660-a243cdb3fcbab30c.js', revision: 'a243cdb3fcbab30c' },
        { url: '/_next/static/chunks/1736-2503e50ff2146aa2.js', revision: '2503e50ff2146aa2' },
        { url: '/_next/static/chunks/2121-be424ff408f653c9.js', revision: 'be424ff408f653c9' },
        { url: '/_next/static/chunks/214-646890e875aaec7c.js', revision: '646890e875aaec7c' },
        { url: '/_next/static/chunks/234.02e5e5be6aed06cf.js', revision: '02e5e5be6aed06cf' },
        { url: '/_next/static/chunks/2440-59f58193c9ec758e.js', revision: '59f58193c9ec758e' },
        { url: '/_next/static/chunks/2823-7377db7ae4e95f5f.js', revision: '7377db7ae4e95f5f' },
        { url: '/_next/static/chunks/2884.32ca81241c63fd6e.js', revision: '32ca81241c63fd6e' },
        { url: '/_next/static/chunks/2943-d2ef64ec7398ded6.js', revision: 'd2ef64ec7398ded6' },
        { url: '/_next/static/chunks/2984-32e0b5699d1f60ec.js', revision: '32e0b5699d1f60ec' },
        { url: '/_next/static/chunks/3006-e6c5a7d86488a5f5.js', revision: 'e6c5a7d86488a5f5' },
        { url: '/_next/static/chunks/3190.e3416cd43fbf6779.js', revision: 'e3416cd43fbf6779' },
        { url: '/_next/static/chunks/3494-7a95036e9e4c8ebc.js', revision: '7a95036e9e4c8ebc' },
        { url: '/_next/static/chunks/3551-8a9dc9464fae1dc8.js', revision: '8a9dc9464fae1dc8' },
        { url: '/_next/static/chunks/3607-6ba183b57d116a58.js', revision: '6ba183b57d116a58' },
        { url: '/_next/static/chunks/3611ccb9-5251c1869bcf650f.js', revision: '5251c1869bcf650f' },
        { url: '/_next/static/chunks/4070-daf215c4bede5463.js', revision: 'daf215c4bede5463' },
        { url: '/_next/static/chunks/408e7d04-fbc6c1e747463506.js', revision: 'fbc6c1e747463506' },
        { url: '/_next/static/chunks/4242-8925c62f37feb94b.js', revision: '8925c62f37feb94b' },
        { url: '/_next/static/chunks/4567-94ae0864f5076a50.js', revision: '94ae0864f5076a50' },
        { url: '/_next/static/chunks/4569-68b87e24a80e270c.js', revision: '68b87e24a80e270c' },
        { url: '/_next/static/chunks/458-f179c0d4b8d4c3cb.js', revision: 'f179c0d4b8d4c3cb' },
        { url: '/_next/static/chunks/4604-9c035e2d2d46b490.js', revision: '9c035e2d2d46b490' },
        { url: '/_next/static/chunks/4733-1b2eeac3ba1b6d56.js', revision: '1b2eeac3ba1b6d56' },
        { url: '/_next/static/chunks/4818-b91df1d187e599bd.js', revision: 'b91df1d187e599bd' },
        { url: '/_next/static/chunks/4835-be8da15d5a014bcf.js', revision: 'be8da15d5a014bcf' },
        { url: '/_next/static/chunks/4891-82ee0da5dbb6cbbb.js', revision: '82ee0da5dbb6cbbb' },
        { url: '/_next/static/chunks/4966-a6435cd0ffaad4a6.js', revision: 'a6435cd0ffaad4a6' },
        { url: '/_next/static/chunks/5061-fa684d6519449c31.js', revision: 'fa684d6519449c31' },
        { url: '/_next/static/chunks/5219-775865f7dbabb483.js', revision: '775865f7dbabb483' },
        { url: '/_next/static/chunks/5331-8489eba4eb5144e6.js', revision: '8489eba4eb5144e6' },
        { url: '/_next/static/chunks/5403-e494c53a2bae856c.js', revision: 'e494c53a2bae856c' },
        { url: '/_next/static/chunks/547-e04ca3bd3d16d3f6.js', revision: 'e04ca3bd3d16d3f6' },
        { url: '/_next/static/chunks/5748-be868940ac86cd04.js', revision: 'be868940ac86cd04' },
        { url: '/_next/static/chunks/583-87dc5b42ca8dc681.js', revision: '87dc5b42ca8dc681' },
        { url: '/_next/static/chunks/5922-c2b0f85073d0bd60.js', revision: 'c2b0f85073d0bd60' },
        { url: '/_next/static/chunks/6086-92b00f4860979cde.js', revision: '92b00f4860979cde' },
        { url: '/_next/static/chunks/6204-361231bab02e0dc1.js', revision: '361231bab02e0dc1' },
        { url: '/_next/static/chunks/6317.65c049494ddd468a.js', revision: '65c049494ddd468a' },
        { url: '/_next/static/chunks/6327-7563e85dc71990e1.js', revision: '7563e85dc71990e1' },
        { url: '/_next/static/chunks/6379-f22602634cec1da6.js', revision: 'f22602634cec1da6' },
        { url: '/_next/static/chunks/6586-d968bcfd91fef139.js', revision: 'd968bcfd91fef139' },
        { url: '/_next/static/chunks/6829-eeb2d608407b9398.js', revision: 'eeb2d608407b9398' },
        { url: '/_next/static/chunks/6951-481b1c28022fb15d.js', revision: '481b1c28022fb15d' },
        { url: '/_next/static/chunks/6953-f20910b1c3d940c0.js', revision: 'f20910b1c3d940c0' },
        { url: '/_next/static/chunks/710-740acbc3088953aa.js', revision: '740acbc3088953aa' },
        { url: '/_next/static/chunks/7100-1bc626e6c48af11c.js', revision: '1bc626e6c48af11c' },
        { url: '/_next/static/chunks/7318-cdbd84961da5e477.js', revision: 'cdbd84961da5e477' },
        { url: '/_next/static/chunks/739-b1e279d2fd8fc249.js', revision: 'b1e279d2fd8fc249' },
        { url: '/_next/static/chunks/7488-07db5a19f032266b.js', revision: '07db5a19f032266b' },
        { url: '/_next/static/chunks/7679-60933e872001328f.js', revision: '60933e872001328f' },
        { url: '/_next/static/chunks/77-8a65aefaf965618c.js', revision: '8a65aefaf965618c' },
        { url: '/_next/static/chunks/7703-2dd26e424e9b869d.js', revision: '2dd26e424e9b869d' },
        { url: '/_next/static/chunks/7809-3ac8d26757f5f21a.js', revision: '3ac8d26757f5f21a' },
        { url: '/_next/static/chunks/807-4022696c37d14fbd.js', revision: '4022696c37d14fbd' },
        { url: '/_next/static/chunks/8180-4974cf476156baa1.js', revision: '4974cf476156baa1' },
        { url: '/_next/static/chunks/8244-e4ab3261e378f5fb.js', revision: 'e4ab3261e378f5fb' },
        { url: '/_next/static/chunks/8698-dee75799e16dfa81.js', revision: 'dee75799e16dfa81' },
        { url: '/_next/static/chunks/8861-cfd6ef0193bf58a5.js', revision: 'cfd6ef0193bf58a5' },
        { url: '/_next/static/chunks/8864-9937611f56632d88.js', revision: '9937611f56632d88' },
        { url: '/_next/static/chunks/9157-05081d861ebf7efc.js', revision: '05081d861ebf7efc' },
        { url: '/_next/static/chunks/9210-eeb2d608407b9398.js', revision: 'eeb2d608407b9398' },
        { url: '/_next/static/chunks/92ea81c9-b48b5c48293ebc9f.js', revision: 'b48b5c48293ebc9f' },
        { url: '/_next/static/chunks/938-587308376d540b8a.js', revision: '587308376d540b8a' },
        { url: '/_next/static/chunks/9411-e7a2599006b588dc.js', revision: 'e7a2599006b588dc' },
        { url: '/_next/static/chunks/956-ad15b1758f5e1028.js', revision: 'ad15b1758f5e1028' },
        { url: '/_next/static/chunks/9739-e6dc30e88cbea169.js', revision: 'e6dc30e88cbea169' },
        { url: '/_next/static/chunks/9785-c94f1ab5fdaa9721.js', revision: 'c94f1ab5fdaa9721' },
        { url: '/_next/static/chunks/9815-8ec60df16cc1248a.js', revision: '8ec60df16cc1248a' },
        { url: '/_next/static/chunks/9819-5ab909f5d1d6b945.js', revision: '5ab909f5d1d6b945' },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(auth)/error-e1e9089c376a1fc1.js',
          revision: 'e1e9089c376a1fc1',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(auth)/forgot-password/page-7eec25cf5243eaf4.js',
          revision: '7eec25cf5243eaf4',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(auth)/layout-5edb3f1b606ab0b3.js',
          revision: '5edb3f1b606ab0b3',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(auth)/loading-1ee9b13f38cf8167.js',
          revision: '1ee9b13f38cf8167',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(auth)/login/page-464d878188e6441a.js',
          revision: '464d878188e6441a',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(auth)/register/page-8e22aa870636c2a3.js',
          revision: '8e22aa870636c2a3',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(auth)/reset-password/page-32a80ca2d2bfba0c.js',
          revision: '32a80ca2d2bfba0c',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(auth)/verify-email/callback/page-5b1914821d2e41f2.js',
          revision: '5b1914821d2e41f2',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(auth)/verify-email/page-b4e1feb0da62e4b9.js',
          revision: 'b4e1feb0da62e4b9',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/about/page-a5039ae3bc110673.js',
          revision: 'a5039ae3bc110673',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/admin/ai-agent/page-c86c82ee7211ed6d.js',
          revision: 'c86c82ee7211ed6d',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/admin/audit-logs/page-93015aab1699d5b1.js',
          revision: '93015aab1699d5b1',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/admin/content/page-d821fca52a6def51.js',
          revision: 'd821fca52a6def51',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/admin/deadlines/page-3bc4a1edd92cf548.js',
          revision: '3bc4a1edd92cf548',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/admin/essays/page-9bcc8ad6ae8cee72.js',
          revision: '9bcc8ad6ae8cee72',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/admin/events/page-1bd292eb4628ac2d.js',
          revision: '1bd292eb4628ac2d',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/admin/layout-500851fd1ad0cf9b.js',
          revision: '500851fd1ad0cf9b',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/admin/memory/page-8a38541129c2b25a.js',
          revision: '8a38541129c2b25a',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/admin/page-91a4093949684db3.js',
          revision: '91a4093949684db3',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/admin/payments/page-3e0599beb906ce82.js',
          revision: '3e0599beb906ce82',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/admin/points/page-9ad3774e03b15ead.js',
          revision: '9ad3774e03b15ead',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/admin/reports/page-a7b88d14e2df15b8.js',
          revision: 'a7b88d14e2df15b8',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/admin/schools/page-4a1ef45db0ba94b5.js',
          revision: '4a1ef45db0ba94b5',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/admin/settings/page-330b820dc72ad4f4.js',
          revision: '330b820dc72ad4f4',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/admin/users/page-9e4b5cc68cf0e732.js',
          revision: '9e4b5cc68cf0e732',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/ai/page-144109ff955d7c0a.js',
          revision: '144109ff955d7c0a',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/assessment/page-d39c9b418d8bc246.js',
          revision: 'd39c9b418d8bc246',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/cases/%5Bid%5D/page-81e456899252f9ac.js',
          revision: '81e456899252f9ac',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/cases/page-46aac109f4320386.js',
          revision: '46aac109f4320386',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/chat/page-fe6b88fd0df54181.js',
          revision: 'fe6b88fd0df54181',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/dashboard/loading-1ee9b13f38cf8167.js',
          revision: '1ee9b13f38cf8167',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/dashboard/page-c5718b95046475c9.js',
          revision: 'c5718b95046475c9',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/error-b586b6b5580a1d1c.js',
          revision: 'b586b6b5580a1d1c',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/essay-gallery/page-8d90105ebb281ca0.js',
          revision: '8d90105ebb281ca0',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/essays/loading-1ee9b13f38cf8167.js',
          revision: '1ee9b13f38cf8167',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/essays/page-b69b270b478d83ab.js',
          revision: 'b69b270b478d83ab',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/find-college/page-1b8314735992b06f.js',
          revision: '1b8314735992b06f',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/followers/page-61aae9f7245f1b66.js',
          revision: '61aae9f7245f1b66',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/forum/loading-1ee9b13f38cf8167.js',
          revision: '1ee9b13f38cf8167',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/forum/page-6ce32d733f15f838.js',
          revision: '6ce32d733f15f838',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/hall/page-5762d0d5c570ba4d.js',
          revision: '5762d0d5c570ba4d',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/help/page-2ffc846bdd787cec.js',
          revision: '2ffc846bdd787cec',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/layout-7af388589fd6a59b.js',
          revision: '7af388589fd6a59b',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/loading-1ee9b13f38cf8167.js',
          revision: '1ee9b13f38cf8167',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/prediction/page-465e440bda9d252f.js',
          revision: '465e440bda9d252f',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/privacy/page-98d68dc732a3d2be.js',
          revision: '98d68dc732a3d2be',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/profile/loading-1ee9b13f38cf8167.js',
          revision: '1ee9b13f38cf8167',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/profile/page-b43be056e26c77f9.js',
          revision: 'b43be056e26c77f9',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/ranking/loading-1ee9b13f38cf8167.js',
          revision: '1ee9b13f38cf8167',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/ranking/page-497d23ab7dc91c3c.js',
          revision: '497d23ab7dc91c3c',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/recommendation/page-c6960eb99f5f7157.js',
          revision: 'c6960eb99f5f7157',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/referral/page-bdc45597fe4aea2d.js',
          revision: 'bdc45597fe4aea2d',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/schools/%5Bid%5D/page-d54d2684eb97d0ed.js',
          revision: 'd54d2684eb97d0ed',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/schools/loading-1ee9b13f38cf8167.js',
          revision: '1ee9b13f38cf8167',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/schools/page-b577e203dabc9b4c.js',
          revision: 'b577e203dabc9b4c',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/settings/page-f8aa4065f7b5627e.js',
          revision: 'f8aa4065f7b5627e',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/settings/security/page-3559d422e9423559.js',
          revision: '3559d422e9423559',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/settings/subscription/page-957a6995251d7da2.js',
          revision: '957a6995251d7da2',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/swipe/page-1ee9b13f38cf8167.js',
          revision: '1ee9b13f38cf8167',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/terms/page-e2a7c84f4308ff53.js',
          revision: 'e2a7c84f4308ff53',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/timeline/page-a0a09d4ba99edee1.js',
          revision: 'a0a09d4ba99edee1',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/uncommon-app/page-4e9582cbe88c5fa1.js',
          revision: '4e9582cbe88c5fa1',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/vault/page-f868f7b7af611a25.js',
          revision: 'f868f7b7af611a25',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/(main)/verified-ranking/page-de3a31ecd790145c.js',
          revision: 'de3a31ecd790145c',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/layout-e29cd60aed22a8ad.js',
          revision: 'e29cd60aed22a8ad',
        },
        {
          url: '/_next/static/chunks/app/%5Blocale%5D/page-b820ee5c00dd7325.js',
          revision: 'b820ee5c00dd7325',
        },
        {
          url: '/_next/static/chunks/app/_global-error/page-1ee9b13f38cf8167.js',
          revision: '1ee9b13f38cf8167',
        },
        {
          url: '/_next/static/chunks/app/_not-found/page-1ee9b13f38cf8167.js',
          revision: '1ee9b13f38cf8167',
        },
        { url: '/_next/static/chunks/app/error-e6c8ef85034e863f.js', revision: 'e6c8ef85034e863f' },
        {
          url: '/_next/static/chunks/app/layout-1ee9b13f38cf8167.js',
          revision: '1ee9b13f38cf8167',
        },
        {
          url: '/_next/static/chunks/app/not-found-0c159b5d2dec7c29.js',
          revision: '0c159b5d2dec7c29',
        },
        { url: '/_next/static/chunks/app/page-1ee9b13f38cf8167.js', revision: '1ee9b13f38cf8167' },
        {
          url: '/_next/static/chunks/app/robots.txt/route-1ee9b13f38cf8167.js',
          revision: '1ee9b13f38cf8167',
        },
        {
          url: '/_next/static/chunks/app/sitemap.xml/route-1ee9b13f38cf8167.js',
          revision: '1ee9b13f38cf8167',
        },
        { url: '/_next/static/chunks/b5ca9577-5e2b5d3e03febf32.js', revision: '5e2b5d3e03febf32' },
        { url: '/_next/static/chunks/d5e1ebe5-7ca8bdda7a275f4d.js', revision: '7ca8bdda7a275f4d' },
        { url: '/_next/static/chunks/d8e88268-e7c6bebc746cead9.js', revision: 'e7c6bebc746cead9' },
        { url: '/_next/static/chunks/framework-fdcac66e7161dd06.js', revision: 'fdcac66e7161dd06' },
        { url: '/_next/static/chunks/main-1c2c8b0eea4e0045.js', revision: '1c2c8b0eea4e0045' },
        { url: '/_next/static/chunks/main-app-21d4ccb57ae5eff7.js', revision: '21d4ccb57ae5eff7' },
        {
          url: '/_next/static/chunks/next/dist/client/components/builtin/app-error-1ee9b13f38cf8167.js',
          revision: '1ee9b13f38cf8167',
        },
        {
          url: '/_next/static/chunks/next/dist/client/components/builtin/forbidden-1ee9b13f38cf8167.js',
          revision: '1ee9b13f38cf8167',
        },
        {
          url: '/_next/static/chunks/next/dist/client/components/builtin/global-error-ffb48defa0934248.js',
          revision: 'ffb48defa0934248',
        },
        {
          url: '/_next/static/chunks/next/dist/client/components/builtin/unauthorized-1ee9b13f38cf8167.js',
          revision: '1ee9b13f38cf8167',
        },
        {
          url: '/_next/static/chunks/polyfills-42372ed130431b0a.js',
          revision: '846118c33b2c0e922d7b3a7676f81f6f',
        },
        { url: '/_next/static/chunks/webpack-496497ec01d810bf.js', revision: '496497ec01d810bf' },
        { url: '/_next/static/css/9dae90f238ec9279.css', revision: '9dae90f238ec9279' },
        { url: '/_next/static/css/b57342985682ee92.css', revision: 'b57342985682ee92' },
        { url: '/_next/static/css/d38261e715b3739d.css', revision: 'd38261e715b3739d' },
        {
          url: '/_next/static/media/27834908180db20f-s.p.woff2',
          revision: 'b39676298197422e3f5284bfafdc7dc3',
        },
        {
          url: '/_next/static/media/78fec81b34c4a365.p.woff2',
          revision: '8383036bed6b5635fbd81508767479af',
        },
        { url: '/file.svg', revision: 'd09f95206c3fa0bb9bd9fefabfd0ea71' },
        { url: '/globe.svg', revision: '2aaafa6a49b6563925fe440891e32717' },
        { url: '/manifest.json', revision: 'b1ac2234a11b76eea862d710a74ff07e' },
        { url: '/next.svg', revision: '8e061864f388b47f33a1c3780831193e' },
        { url: '/vercel.svg', revision: 'c0af2f507b369b085b35ef4bbe3bcf1e' },
        { url: '/window.svg', revision: 'a2760511c65806022ad20adf74370ff3' },
      ],
      { ignoreURLParametersMatching: [/^utm_/, /^fbclid$/] }
    ),
    e.cleanupOutdatedCaches(),
    e.registerRoute(
      '/',
      new e.NetworkFirst({
        cacheName: 'start-url',
        plugins: [
          {
            cacheWillUpdate: async ({ response: e }) =>
              e && 'opaqueredirect' === e.type
                ? new Response(e.body, { status: 200, statusText: 'OK', headers: e.headers })
                : e,
          },
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-images',
        plugins: [new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 2592e3 })],
      }),
      'GET'
    ),
    e.registerRoute(
      /^https:\/\/api\..*/i,
      new e.NetworkFirst({
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10,
        plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })],
      }),
      'GET'
    ),
    (self.__WB_DISABLE_DEV_LOGS = !0));
});
