const flat = require("flat");
const fs = require("fs");
const moment = require('moment');
let metadata = [];

function array(arr) {
  if (Array.isArray(arr)) return arr;
  else return [];
}

function find_tag(key, lang) {
  const find = hexo.locals.get("data").tags.find((p) => {
    var n = Object.assign({}, p);
    delete n["post"];
    return Object.values(flat(n)).includes(key);
  });
  if (find == undefined) return null;
  return find[lang];
}

function find_dept(key, lang) {
  const find = hexo.locals
    .get("data")
    .departments.find((p) => Object.values(flat(p)).includes(key));
  if (find == undefined) return null;
  return find[lang];
}

function structured_data() {
  let db = hexo.locals.get("data");
  Object.keys(db)
    .filter((table) => !table.includes("/"))
    .forEach((table) => {
      Object.keys(db[table]).forEach((row) => {
        Object.keys(db[table][row])
          .filter((col) => !["zh-tw", "en"].includes(col))
          .forEach((col) => {
            db[table][row]["zh-tw"][col] = db[table][row][col];
            db[table][row]["en"][col] = db[table][row][col];
          });
      });
    });
  hexo.locals.set("data", () => db);
}

function generate_metadata() {
  hexo.locals
    .get("pages")
    .filter(
      (p) =>
        p.lang == "zh-tw" &&
        p.layout == "post" &&
        p.publish.toLowerCase() == "true"
    )
    .sort("id")
    .each((post) => {
      let tags = array(post.tags)
        .map((i) => find_tag(i, "zh-tw"))
        .filter((n) => n)
        .map((i) => i.id);
      let depts = array(post.departments)
        .map((i) => find_dept(i, "zh-tw"))
        .filter((n) => n)
        .map((i) => i.id);
      metadata.push({
        id: post.id,
        title: post.title,
        description: post.description,
        content: post.introduction ? post.introduction.content : "",
        path: post.path,
        thumbnail: post.thumbnail,
        tags: tags,
        depts: depts,
        meeting_date: post.meeting_date,
      });
    });
}

function create_json() {
  fs.mkdirSync("public/json", { recursive: true });
  fs.writeFileSync("public/json/cases.json", JSON.stringify(metadata));
}

function update_post() {
  const ps = hexo.locals.get("pages");
  ps.forEach((p) => {
    if (p.lang == "zh-tw" && p.layout == "post" && p.description != undefined) {
      p.description = `開放政府第${p.id}案協作會議${p.description}`;
    }
  });
  hexo.locals.set("pages", function () {
    return ps;
  });
}

const request = require("request-promise");
const cheerio = require("cheerio");
async function req(link) {
  let head = await request(link);
  const $ = cheerio.load(head);

  let image = $('meta[property="og:image"]').attr("content");
  let title = $('meta[property="og:title"]').attr("content");
  let subtitle = $('meta[name="description"]').attr("content");
  let date = $(".post-header").find("time").text().replace(/\s/g, "");
  let authors = $('meta[name="author"]').attr("content");

  return { link, image, title, subtitle, date, authors };
}

hexo.extend.filter.register("before_post_render", async function (data) {
  if (data.blogs) {
    let d = [];
    for (const i of data.blogs) {
      if (i.toString().startsWith("http")) {
        let obj = await req(i);
        d.push(obj);
      }
    }

    data.blogs = d;
  }

  data = bf_post_render(data);

  return data;
});

function bf_post_render(data) {
  let html_path = data.path.split("/");

  // Set lang
  const lang = html_path[0];
  if (lang == "en" || lang == "zh-tw") {
    data.lang = lang;
  }

  if (data.layout == "false") return data;

  // Remove post folder
  if (html_path[1] == "post") {
    html_path.splice(1, 1);
  }

  // Remove zh-tw folder
  if (html_path[0] == "zh-tw") {
    html_path.shift();
  }

  // Update html file to folder. Ex: list.html => list/index.html
  const filename = html_path[html_path.length - 1];
  if (filename == "index.html") {
    html_path.pop();
  } else {
    html_path[html_path.length - 1] = filename.replace(/.html$/, "");
  }

  data.path = html_path.join("/") + "/";
  // console.log(data.path);
}

hexo.extend.filter.register("before_generate", function () {
  structured_data();
  update_post();
  generate_metadata();
});

hexo.extend.filter.register("after_generate", function () {
  create_json();
});

hexo.extend.helper.register("page_url", function (path, options) {
  return this.url_for(path, options).replace(/index\.html$/, "");
});

// 取得i18n文字
hexo.extend.helper.register("_", function (link) {
  try {
    const target = link.split(".");
    const filename = target.shift();
    let result = hexo.locals.get("data")[`i18n/${filename}`][this.page.lang];
    target.forEach((i) => {
      result = result[i];
    });
    if (result == undefined) throw "undefined";
    return result;
  } catch (e) {
    return null;
  }
});

hexo.extend.helper.register("array", (arr) => array(arr));

hexo.extend.helper.register("embed_link", function (link, options = {}) {
  try {
    const url = new URL(link);
    if (
      (url.hostname == "www.youtube.com" && url.pathname == "/watch") ||
      url.hostname == "youtu.be"
    ) {
      if (url.hostname == "www.youtube.com") {
        id = url.searchParams.get("v");
      } else {
        id = url.pathname.split("/")[1];
      }
      link = `https://www.youtube.com/embed/${id}`;
      if (options.loop) {
        link += `?loop=1&playlist=${id}`;
      }
    } else if (url.hostname == "issuu.com") {
      id = url.pathname.split("/")[3];
      user = url.pathname.split("/")[1];
      link = `https://e.issuu.com/embed.html?pageLayout=singlePage&hideIssuuLogo=true&u=${user}&d=${id}`;
    } else if (
      link.includes("https://miro.com/app/board/") ||
      link.includes("https://miro.com/app/live-embed/")
    ) {
      id = url.pathname.split("/")[3];
      //link = `https://miro.com/app/live-embed/${id}/?embedAutoplay=true`;
      link = `https://miro.com/app/embed/${id}/?embedAutoplay=true`;
    }
    return link;
  } catch (e) {
    return link;
  }
});

hexo.extend.helper.register("find_case", function (tags) {
  tags.forEach((t) => (t.post = []));
  const tag_name = tags.map((i) => i[this.page.lang].name);
  hexo.locals
    .get("pages")
    .filter(
      (page) =>
        page.layout == "post" &&
        page.lang == this.page.lang &&
        page.publish.toString().toLowerCase() == "true"
    )
    .forEach((page) => {
      if (page.tags != null)
        page.tags.forEach((t) => {
          if (tag_name.includes(t)) {
            tags[tag_name.indexOf(t)].post.push(page);
          }
        });
    });
  return tags;
});

hexo.extend.helper.register("find_tag", function (key) {
  return find_tag(key, this.page.lang);
});

hexo.extend.helper.register("find_dept", function (key) {
  return find_dept(key, this.page.lang);
});

hexo.extend.helper.register("get_metadata", function () {
  return metadata;
});

hexo.extend.helper.register("date_fmt", function (date) {
  const d = moment(date).format('YYYY-MM-DD');
  if (d == "Invalid date") {
    return date;
  }
  return d;
});
