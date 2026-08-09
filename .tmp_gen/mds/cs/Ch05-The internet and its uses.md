# Ch05 · The internet and its uses（互联网及其用途）

> 来源：Computer Science for Cambridge IGCSE & O Level Coursebook（Sarah Lawrey & Victoria Ellis，2nd ed）Chapter 5 正文
> 内容依据教材原文整理；定义取自教材 KEY WORDS 框，以课本为准；中文对照为辅助翻译。
> 配套 PDF：分章节/Ch05-The internet and its uses.pdf

## 学习目标（Learning intentions 原文，中文辅助）

- learn what the difference is between the internet and the world wide web（学习互联网与万维网的区别）
- understand what is meant by a URL and study the purpose of each of its component parts（理解 URL 的含义并研究其各部分的作用）
- discover the purpose and operation of the hypertext transfer protocol (HTTP) and the hypertext transfer protocol secure (HTTPS)（发现 HTTP 与 HTTPS 的用途与运作）
- learn about the different functions that a web browser performs, including the use of cookies（学习网页浏览器的不同功能，包括 cookie 的使用）
- discover how web pages are requested, retrieved and displayed on your computer or device（发现网页如何在设备上被请求、获取与显示）
- understand what is meant by a digital currency and how blockchain is used to track digital currency transactions（理解数字货币的含义及区块链如何跟踪数字货币交易）
- learn about a range of cyber security threats and how a range of different solutions can be used to keep data safe from these threats（学习一系列网络安全威胁及可用多种解决方案保护数据安全）

## 关键词与原文定义（KEY WORDS）

| 关键词 (EN) | 原文定义（教材 KEY WORDS 框） | 中文对照 |
|-------------|--------------------------|----------|
| internet | A very large global network that allows users to access the world wide web. | 互联网 |
| infrastructure | The physical structure, such as all the components and cables, that are used to connect devices. | 基础设施 |
| network | Computers and devices that are joined together using cables or wireless technology. | 网络 |
| world wide web | The collection of all the web pages and websites that have been made available. | 万维网 |
| website | A collection of web pages, normally about a related topic or purpose. | 网站 |
| web page | A single page within a website. | 网页 |
| uniform resource locator (URL) | Another name for the text-based address for a website. | 统一资源定位符 |
| web browser | A piece of software that retrieves and displays web pages. | 网页浏览器 |
| protocol | A set of rules for transmitting data. | 协议 |
| domain name | A specific part of a URL that contains the unique name for the web server. | 域名 |
| domain name server (DNS) | A special server that contains a database of domain names and their corresponding IP address. | 域名服务器 |
| web server | A network component where the web pages for a website are stored. | 网页服务器 |
| hypertext transfer protocol (HTTP) | A protocol that is used for the transmission of web pages and related data across the internet. | 超文本传输协议 |
| hypertext markup language (HTML) | A scripting (web authoring) language that is used to create web pages. | 超文本标记语言 |
| cascading style sheet (CSS) | A scripting language that is used to create a presentation template for a web page. It includes what kind of font and colour text will appear on the webpage. | 层叠样式表 |
| active script | This is the script that is used to produce any of the interactive elements of a web page. | 活动脚本 |
| hypertext transfer protocol secure (HTTPS) | A secure version of the HTTP that encrypts data for transmission. | 安全超文本传输协议 |
| encryption | A method of securing data for storage or transmission that scrambles it and makes it meaningless. | 加密 |
| digital certificate | A certificate that is awarded to a website if they can prove that they are a real organisation and take measures to securely transmit their data. | 数字证书 |
| certificate authority | The awarding organisation that checks if another organisation is real and secure before awarding them a digital certificate. | 证书颁发机构 |
| secure sockets layer (SSL) protocol | A type of protocol that encrypts data for transmission. It is the protocol that is combined with the HTTP to create HTTPS. | SSL 协议 |
| transport layer security (TLS) protocol | An updated version of the SSL protocol. | TLS 协议 |
| render | The method of processing all the web page data, such as HTML, to display the web page. | 渲染 |
| address bar | The section of a web browser where you type the web page address. | 地址栏 |
| user history | A record made on your web browser of all the web pages that you have visited. | 浏览历史 |
| bookmark | A link that can be created to allow you to quickly find a web page again. | 书签 |
| tab | A website function that allows you to open multiple web pages in the same window. | 标签页 |
| window | A viewing area that is created in which a software application or file can be opened. | 窗口 |
| navigate | Move around web pages, or move back or forward to previous web pages. | 导航 |
| cookie | Small text file that is used to store personal data, by a web browser. | Cookie |
| session cookie | A type of cookie that is deleted when the web browser is closed. | 会话 Cookie |
| persistent cookie | A type of cookie that is stored by the web browser until it is deleted by the user or because it has expired. | 持久 Cookie |
| digital currency | A currency that exists electronically rather than physically. | 数字货币 |
| cryptocurrency | A type of digital currency that uses encryption procedures. | 加密货币 |
| blockchain | A method that is used to track all the transactions made with a cryptocurrency. | 区块链 |
| digital ledger | A database that is a list of all the transactions recorded by the use of blockchain. | 数字账本 |
| perpetrator | A person that carries out an illegal or immoral action. | 违法者（攻击者） |
| brute-force attack | A type of cyber threat that involves repeatedly inputting a password until the correct one is found, to try and break into an account or device. | 暴力破解攻击 |
| biometric password | A type of password that uses a person's biological data, such as their fingerprint. | 生物识别密码 |
| biometric device | A device that allows a user to record and input a biometric password. | 生物识别设备 |
| two-step verification | A process that involves inputting two different kinds of data to enter an account or device. | 两步验证 |
| data packet | A unit of data that is used to transmit data across a network. | 数据包 |
| packet sniffer | A piece of software that is used to examine the contents in a packet of data. | 数据包嗅探器 |
| distributed denial of service (DDoS) attack | A type of cyber threat that targets a web server to cause it to crash and prevent access to the web pages that it stores. | 分布式拒绝服务攻击 |
| botnet | A network of bots that are created to carry out a DDoS attack. | 僵尸网络 |
| bot | The name given to a computer that has had malware downloaded onto it that will cause it to be used in a DDoS attack. | 僵尸主机 |
| zombie | The name given to a bot that has malware downloaded onto it to allow it to be used in a DDoS attack, but it currently isn't being used in this way. It is effectively a dormant or sleeping bot. | 休眠僵尸 |
| proxy server | A method of cyber security that examines requests sent by devices to access the web pages stored on a web server. | 代理服务器 |
| anti-malware | A type of software that scans a computer or device with the purpose of finding and removing malware. | 反恶意软件 |
| hacking | The act of gaining unauthorised access to data. This is normally done to steal or corrupt the data. | 黑客攻击 |
| hacker | The name given to a perpetrator that carries out an act of hacking. | 黑客 |
| firewall | A cyber security method that is used to examine incoming and outgoing traffic from a computer or network. | 防火墙 |
| port | An entry point into a computer or network. | 端口 |
| virus | A software based cyber threat that replicates itself with the aim of corrupting data or filling up the available memory space in a computer, causing it to crash. | 病毒 |
| worm | A software based cyber threat that replicates itself across a network using vulnerabilities that it finds, with the aim of clogging up the bandwidth. | 蠕虫 |
| trojan horse | A software based cyber threat that is used to disguise other malware to try and smuggle it into a computer or network. | 木马 |
| spyware | A software based cyber threat that spies on a user's actions whilst using a computer, such as logging their key presses. | 间谍软件 |
| adware | A software based cyber issue that automatically creates popup advertisements. | 广告软件 |
| ransomware | A software based cyber threat that encrypts a user's data to stop them gaining access to it until a ransom (money) is paid. | 勒索软件 |
| anti-virus | A type of software that scans a computer for viruses with the purpose of finding and removing them. | 杀毒软件 |
| data backup | A copy of data that is stored separate from the computer. | 数据备份 |
| pharming | A type of cyber threat that involves downloading malicious software onto a user's hard drive, that redirects a request aimed at a genuine website to a fake website instead. | 域名劫持（Pharming） |
| phishing | A type of cyber threat that involves sending a user a fake email that is designed to look genuine. It will encourage the user to provide their personal data either by clicking a link to a fake website, or by responding to the email. | 钓鱼攻击 |
| social engineering | A cyber threat that involves manipulating or deceiving people into providing confidential or personal data. | 社会工程学攻击 |
| access level | The amount of direct access a user is given to data and resources. This could be set to be only certain sections of a whole collection of data and resources. | 访问级别 |
| username | A text-based identification that is given to a user that identifies the level of access that they have to stored data and resources. | 用户名 |

## 技能重点（SKILLS FOCUS，需掌握的重要能力）

（本章技能重点为网络安全威胁与对策的系统化能力——每种威胁用"发生了什么/目的是什么/可用哪些安全方案"三段式掌握：）

### 网络威胁三段式记忆法（Cyber threat: what happens / aim / solutions）
- **内容 Content**: For each threat, learn: 1) What happens? 2) What is the aim? 3) What security solutions can be used? Brute-force attack: repeated password guessing → steal data or use account → strong password, limited attempts, biometric password, two-step verification. Data interception: packets examined by packet sniffer → identity theft/fraud → encryption (SSL/HTTPS), check URL. DDoS: botnet floods web server → crash (money demand, revenge/activism) → proxy server (with caching), anti-malware scans. Hacking: unauthorised access via vulnerabilities → steal/corrupt/leak data → firewall (close ports), automatic software updates, strong/biometric passwords, two-step verification. Malware (virus/worm/trojan/spyware/adware/ransomware): malicious software downloaded → corrupt data/gain access/damage hardware → anti-malware (anti-virus, anti-spyware), firewall, caution when downloading, data backup. Pharming: malicious software redirects requests to fake website → steal personal data → anti-malware, visual website checks, trusted sources only. Phishing: fake email → click link to fake website → steal personal data → check spelling/tone, personalisation, URL, HTTPS. Social engineering: manipulation/deception → personal data for criminal activity → access levels, awareness training.（每种威胁按"发生了什么/目的/解决方案"三段掌握：暴力破解→强密码+限制尝试次数+生物密码+两步验证；数据截获→加密（SSL/HTTPS）+查 URL；DDoS→代理服务器（带缓存）+反恶意软件；黑客→防火墙（关端口）+自动更新+强密码+两步验证；恶意软件（病毒/蠕虫/木马/间谍/广告/勒索）→反恶意软件+防火墙+谨慎下载+数据备份；Pharming→反恶意软件+视觉检查网站+只从可信源下载；钓鱼→检查拼写/语气/个性化/URL/HTTPS；社会工程学→访问级别+员工培训）
- **要点 Key points**: 每种威胁的解决方案都要联系具体场景回答（考试论证题）；加密不能阻止数据被截获，只是让截获的数据无意义（中文要点）

### 网页请求-获取-显示全流程（How web pages are located, retrieved and displayed）
- **内容 Content**: 1) User types URL into address bar of web browser. 2) Browser sends URL to the domain name server (DNS), which searches its database for the domain name and returns the equivalent IP address (of the web server); if not found, the request passes to the next DNS until found or "website not found" is returned. 3) Browser sends a request to the web server using HTTP. 4) Web server sends the data for the web page (HTML, CSS, active script such as JavaScript) back using HTTP. 5) Browser renders the HTML and CSS and runs any active script to display the web page. HTTPS adds a security layer: before sending the request, the browser asks the web server for its digital certificate, checks it is authentic (issued by a certificate authority); if authentic, communication continues with encrypted data transmission (SSL/TLS); if not, the browser reports the website is not secure.（用户输入 URL→浏览器把 URL 发给 DNS 查找域名对应的 IP 地址（找不到则传给下一个 DNS，直到找到或返回"网站未找到"）→浏览器用 HTTP 向网页服务器发请求→服务器用 HTTP 返回网页数据（HTML、CSS、活动脚本如 JavaScript）→浏览器渲染 HTML/CSS 并运行活动脚本显示网页；HTTPS 增加安全层：浏览器先请求服务器的数字证书并验证真实性（由证书颁发机构签发），真实则继续并以加密方式传输数据（SSL/TLS），不真实则报告网站不安全）
- **要点 Key points**: 域名对应 IP 地址的查找由 DNS 完成；URL 三部分 = 协议 + 域名 + 网页/文件名；HTTPS = HTTP + SSL/TLS（加密层）（中文要点）

## 活动与编程任务（ACTIVITY，英文原文为主、中文辅助）

### ACTIVITY 5.1 The first web page（第一个网页）
- **内容 Content**: Have a look at what the first web page looked like. Type 'the world wide web project' into your browser and look for the 'info.cern' link.（在浏览器中搜索 the world wide web project，查看第一个网页的样子（info.cern 链接））

### ACTIVITY 5.2 TLS research（TLS 研究）
- **内容 Content**: Use the internet to research why the TLS protocol was developed to replace the SSL protocol.（上网研究为何开发 TLS 协议取代 SSL 协议）

### ACTIVITY 5.3 Web browser examples（浏览器举例）
- **内容 Content**: Can you think of two more examples of a web browser? Use the internet to check if you are correct.（再举两个网页浏览器的例子并上网验证）

### ACTIVITY 5.4 Strong passwords（强密码）
- **内容 Content**: Think about one of your passwords that you use to access an account online. How strong do you think that password is? Do you think that you could improve that password? Create a three-slide presentation that can be given to your peers to tell them how to create a strong password and what the importance is of doing so. Peer assessment: is the information presented clearly? Is it clear how to create a strong password and how important it is? What might happen if a person does not set a strong password?（评估自己一个密码的强度并改进；制作三页演示文稿教同伴如何创建强密码及其重要性；互评）

### ACTIVITY 5.5 VPN research（VPN 研究）
- **内容 Content**: Use the internet to find out how a virtual private network (VPN) can be used to help prevent data interception.（上网研究虚拟专用网络（VPN）如何帮助防止数据截获）

### ACTIVITY 5.6 DDoS case study（DDoS 案例研究）
- **内容 Content**: Use the internet to find out about a huge DDoS attack that was carried out on 21st October 2016, and which companies it affected.（上网研究 2016 年 10 月 21 日的大规模 DDoS 攻击及其影响的公司）

### ACTIVITY 5.7/5.8 Social engineering discussion（社会工程学讨论）
- **内容 Content**: Discuss with a partner what you think the employee could do to stop themselves being the target of a social engineering scam like this one (5.7: fake IT department phone call; 5.8: perpetrator befriending employees after work).（与同伴讨论员工应如何避免成为社会工程学骗局的目标：5.7 假冒 IT 部门电话；5.8 下班后套近乎刺探公司信息）

## 章末 Summary（原文要点，中文辅助）

- The internet is the infrastructure that is used to access the world wide web.（互联网是访问万维网的基础设施）
- The world wide web is the collection of all the web pages that are available.（万维网是所有可用网页的集合）
- A URL is a text based address for a web page that contains the protocol, the domain name and the web page name or file name.（URL 是网页的文本地址，包含协议、域名与网页/文件名）
- The HTTP protocol is used to transmit data between a computer and a web server. This data is not encrypted when sent using this protocol.（HTTP 协议用于计算机与网页服务器之间传输数据，数据不加密）
- The HTTPS protocol is the encrypted version of the HTTP protocol. It uses the SSL protocol to encrypt the data.（HTTPS 是 HTTP 的加密版本，使用 SSL 协议加密数据）
- The main purpose of a web browser is to render HTML to allow a user to view web pages. It also has other functions such as recording a user's history and storing bookmarks, favourites and cookies.（浏览器的主要用途是渲染 HTML 供用户查看网页；还有其他功能：记录历史、保存书签/收藏与 cookie）
- Cookies are used to save your personal data and track your online preferences. They can be session or persistent based.（Cookie 用于保存个人数据与跟踪在线偏好；分会话型与持久型）
- Web pages are located, retrieved and displayed using a web browser, a DNS and a web server.（网页的定位、获取与显示由浏览器、DNS 与网页服务器协作完成）
- A digital currency is a currency that only exists electronically. An example can be cryptocurrency and this kind of digital currency is tracked using blockchain. This is a type of digital ledger that records all payments made using the currency.（数字货币是只以电子形式存在的货币；加密货币是其中一种，用区块链跟踪——区块链是记录所有支付的数字账本，记录一旦添加不可更改且数据加密）
- There are several cyber security threats that exist such as brute-force attacks, data interception, DDoS, hacking, malware, pharming, phishing and social engineering.（存在多种网络安全威胁：暴力破解、数据截获、DDoS、黑客、恶意软件、Pharming、钓鱼与社会工程学）
- The aim of most of the cyber security threats is to steal your personal data to commit identity theft and fraud, or as an act of revenge or activism.（多数威胁的目的是窃取个人数据实施身份盗窃与欺诈，或作为报复/激进行为）
- There are a range of cyber security solutions that can be used to help keep your data safe from security threats such as anti-malware software, firewalls, proxy servers, encryption, authentication (including biometric passwords and two-step verification), privacy settings, automated software updates, access levels and visual checks such as checking the URL that is connected to a link or download.（可用多种安全方案保护数据：反恶意软件、防火墙、代理服务器、加密、认证（生物密码与两步验证）、隐私设置、自动软件更新、访问级别与视觉检查（如检查链接/下载对应的 URL））

## 自查清单（SELF-EVALUATION，原文）

- Explain the difference between the internet and the world wide web（5.1）
- Explain what is meant by a URL and what the different parts of it are（5.2）
- Describe how data is sent using both the HTTP and HTTPS protocols（5.2）
- Describe how web pages are located, retrieved and displayed using a web browser, DNS and a web server（5.2）
- Explain the main purpose of a web browser and identify other functions that they often have（5.2）
- Explain how cookies are used and what the difference is between a session cookie and a persistent cookie（5.3）
- Explain what is meant by a digital currency（5.4）
- Explain how blockchain is used to track certain digital currencies（5.4）
- Describe how a brute-force attack is carried out, what the aim of it is and what security solutions can be used to help prevent it happening（5.5）
- Describe how data can be intercepted, what the aim of it is and how to help prevent it happening（5.5）
- Describe how a DDoS is carried out, what the aim of it is and what security solutions can be used to help prevent it happening（5.5）
- Describe what is meant by hacking, what the aim of it is and what security solutions can be used to help prevent it happening（5.5）
- Describe what is meant by a virus, what the aim of it is and what security solutions can be used to help prevent it being downloaded（5.5）
- Describe what is meant by a worm, what the aim of it is and what security solutions can be used to help prevent it being downloaded（5.5）
- Describe what is meant by a trojan horse, what the aim of it is and what security solutions can be used to help prevent it being downloaded（5.5）
- Describe what is meant by spyware, what the aim of it is and what security solutions can be used to help prevent it being downloaded（5.5）
- Describe what is meant by adware, what the aim of it is and what security solutions can be used to help prevent it being effective（5.5）
- Describe what is meant by pharming, what the aim of it is and what security solutions can be used to help prevent it happening（5.5）
- Describe what is meant by phishing, what the aim of it is and what security solutions can be used to help prevent it happening（5.5）
- Describe what is meant by social engineering, what the aim of it is and what security solutions can be used to help prevent it happening（5.5）
