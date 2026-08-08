# Ch02 · Data transmission（数据传输）

> 来源：Computer Science for Cambridge IGCSE & O Level Coursebook（Sarah Lawrey & Victoria Ellis，2nd ed）Chapter 2 正文
> 内容依据教材原文整理；定义取自教材 KEY WORDS 框，以课本为准；中文对照为辅助翻译。
> 配套 PDF：分章节/Ch02-Data transmission.pdf

## 学习目标（Learning intentions 原文，中文辅助）

- learn how data is broken down into packets to be transmitted, including the contents of each packet（学习数据如何分解为数据包传输，包括每个包的组成）
- understand how data is transmitted using a range of different transmission methods（理解使用各种不同传输方法传输数据）
- be able to choose a data transmission method for a given scenario（能够为给定场景选择数据传输方法）
- learn about the universal serial bus (USB) interface and how it is used to transmit data（学习 USB 接口及其如何传输数据）
- learn how errors can occur when transmitting data（学习传输数据时错误如何发生）
- be able to describe how a range of different error detection methods work（能够描述各种不同错误检测方法的工作原理）
- understand why it is useful to encrypt data when it is transmitted（理解传输时加密数据为何有用）
- be able to describe how data is encrypted using both symmetric and asymmetric encryption（能够描述对称与非对称加密方法）

## 关键词与原文定义（KEY WORDS）

| 关键词 (EN) | 原文定义（教材 KEY WORDS 框） | 中文对照 |
|-------------|--------------------------|----------|
| packet | A small unit of data. | 数据包 |
| packet header | A section of a packet of data that contains information about the contents of the packet and its destination. | 包头 |
| internet protocol (IP) address | The unique address that is given to a device when it is connected to a network. | IP 地址 |
| payload | The actual data that the user is sending to the receiver. | 有效载荷（数据部分） |
| trailer | A section of a packet of data that contains information about any error checking methods that may be used. | 包尾 |
| packet switching | A method of transmitting data packets across a network. Each data packet is able to take an individual pathway across the network. | 分组交换 |
| network | Computers and devices that are joined together using cables or wireless technology. | 网络 |
| router | A network component that examines a data packet to obtain its destination address and then forwards the packet to this address. | 路由器 |
| serial | A transmission method where data is sent one bit at a time down a single wire. | 串行传输 |
| parallel | A transmission method where data is sent multiple bits at a time down multiple wires. | 并行传输 |
| interference | Disruption, such as electromagnetism, to data when it is transmitted. | 干扰 |
| simplex | A transmission method where data is transmitted in a single direction only. | 单工 |
| half-duplex | A transmission method where data is transmitted in both directions, but only one direction at a time. | 半双工 |
| full-duplex | A transmission method where data is transmitted in both directions at the same time. | 全双工 |
| USB | An industry standard that is used to transmit data. | USB（通用串行总线） |
| USB port | A socket that is a part of a device or computer that enables you to insert a USB cable. | USB 端口 |
| USB cable | A type of transmission media that uses the USB method to transmit data. | USB 线缆 |
| USB connection | A collective name for using a USB cable plugged into a USB port to transfer data from one device to another. | USB 连接 |
| USB device | The name of a device that plugs into a USB port on a computer. | USB 设备 |
| ethernet | Another type of connection that can be used to transmit data within a network. | 以太网 |
| parity check | A type of error detection method that adds an additional bit to each byte to create an odd or even sum. | 奇偶校验 |
| checksum | A type of error detection method that performs a calculation on the data to create a checksum value. Checksum values are compared after transmission to see if they match. | 校验和 |
| echo check | A type of error detection method that sends a copy of the transmitted data back to the sender to be compared with the original data sent. | 回显校验 |
| automatic repeat request (ARQ) | A type of error detection method that uses acknowledgement and timeout to see if data has arrived correctly after transmission. | 自动重传请求 |
| acknowledgement | A message that is sent from one device to another to indicate whether data is received correctly. | 确认（应答） |
| timeout | A period of time that is set and used to wait for an acknowledgement to be received. | 超时 |
| check digit | A type of error detection method that is used for data entry. A calculation is performed on the data entered to create a value. Check digit values are compared to see if the data entered is correct. | 校验位 |
| encryption | A method of securing data for storage or transmission that scrambles it and makes it meaningless. | 加密 |
| plain text | The name given to data before encryption. | 明文 |
| encryption key | A type of algorithm that is used to encrypt data. | 加密密钥 |
| cipher text | The name given to data after transmission (encryption). | 密文 |
| symmetric | A type of encryption that uses the same key to encrypt and decrypt data. | 对称加密 |
| asymmetric | A type of encryption that uses two different keys to encrypt and decrypt data. | 非对称加密 |

## 技能重点（SKILLS FOCUS，需掌握的重要能力）

（本章技能重点以场景选择与纠错方法识别为主——教材通过 ACTIVITY 2.2/2.4 与问答强化以下能力：）

### 传输方法的选择能力（Choosing a transmission method for a context）
- **内容 Content**: A connection between two devices is always a combination: serial or parallel AND simplex, half-duplex or full-duplex (e.g. serial simplex, parallel half-duplex, serial full-duplex). Choose based on: distance (serial for long distances – less skew and interference; parallel limited to ~5 m), speed need (parallel faster but more error-prone), direction need (simplex – one way only, e.g. keyboard to computer; half-duplex – both ways but one at a time, e.g. Wi-Fi; full-duplex – both ways at the same time, e.g. telephone conversation), and data accuracy (imperative data needs methods that minimise errors).（两设备间连接必为"串行或并行"与"单工、半双工或全双工"的组合；选择依据：距离（串行适合长距离——不易歪斜、干扰少；并行限约 5 米）、速度（并行快但易错）、方向需求（单工单向如键盘→电脑；半双工双向但同时只一个方向如 Wi-Fi；全双工双向同时如电话）、数据准确性（关键数据需低错误方法））
- **要点 Key points**: 串行：单线逐位传输——顺序到达、干扰少、便宜，但慢；并行：多线多 bit 同时——快，但位会乱序需重排、干扰多、贵（中文要点）

## 活动与编程任务（ACTIVITY，英文原文为主、中文辅助）

### ACTIVITY 2.1 Packet tracer（包追踪器观察数据包）
- **内容 Content**: Ask your teacher if you are allowed to use a packet tracer. Use the packet tracer to send data to another device and look at the data that the packet tracer software provides. What kind of information does it give you? What route did your packets take to get to the destination device?（用包追踪软件向另一设备发送数据并观察其提供的信息：数据包包含什么信息？数据包到达目标设备走的是什么路径？）

### ACTIVITY 2.2 Drawing packet pathways（绘制数据包路径）
- **内容 Content**: Five packets of data need to be sent from device A to device B, each taking a different pathway through routers 1-5. Draw a copy of the network diagram and use coloured pens to draw the pathway that each of the packets of data takes. Self assessment: what did you do to check if your diagram is correct? Have you tried tracing each route to see if it goes through the correct routers?（在五台路由器组成的网络中，五个数据包各走不同路径从设备 A 到设备 B；用彩笔在图上画出每个包的路径并自查）

### ACTIVITY 2.3 Wi-Fi and half-duplex（Wi-Fi 与半双工）
- **内容 Content**: Use the internet to research how half-duplex data transmission is used to create a Wi-Fi connection. Why is half-duplex, rather than full-duplex data transmission used in Wi-Fi connections?（上网研究半双工如何用于 Wi-Fi 连接；为何 Wi-Fi 用半双工而非全双工？）

### ACTIVITY 2.4 Data transmission scenario（编写传输场景题）
- **内容 Content**: Write a data transmission scenario like the one given in Question 11 (a business manager transmitting customer data to a file server 100 m away, needing to send and receive at the same time with imperative accuracy). Think about which data transmission methods could be used and why they would be the most suitable. Peer assessment: give the scenario to a friend and compare your chosen methods and reasons.（编写一个数据传输场景题（参考 Q11：距离 100 m、需同时收发、数据准确性至关重要），思考最合适的传输方法；与同学交换作答并讨论）

### ACTIVITY 2.5 USB speed research（USB 速度研究）
- **内容 Content**: One of the issues with serial data transmission is the transmission speed is slower than parallel. Research how a USB connection is able to transmit data at a faster rate.（串行传输比并行慢；研究 USB 连接为何能以更高速率传输数据）

### ACTIVITY 2.6 USB versions（USB 版本对比）
- **内容 Content**: Research the data transfer speed of USB 4; is this different to USB 1, 2 and 3? What other differences can you find between the different versions of USB?（研究 USB 4 的传输速度与 USB 1/2/3 的差异，找出各版本间的其他区别）

### ACTIVITY 2.7 Modulus 11（模 11 校验法）
- **内容 Content**: Use the internet to find out how the modulus 11 method calculates a value from the data. You do not need to be able to remember how to do this method of calculation for the exam, but it will help you to know how a checksum is calculated.（上网了解模 11 方法如何由数据计算数值；考试不需记忆算法，但有助于理解校验和的计算原理）

### ACTIVITY 2.9/2.10 ARQ diagrams（ARQ 流程图示）
- **内容 Content**: Draw a diagram to represent how an ARQ system operates using positive acknowledgement (2.9); draw a diagram to represent how an ARQ system operates using negative acknowledgement (2.10).（分别画图表示 ARQ 系统使用肯定确认与否定确认的工作流程）

### ACTIVITY 2.11 Check digit vs checksum（校验位与校验和的区别）
- **内容 Content**: With a partner, discuss and write down the differences between a check digit and a checksum. Although the process is similar, you should not confuse the operation of a check digit (used for data entry, e.g. barcode/ISBN scanning) and a checksum (used for transmitted data).（与同伴讨论并写出校验位与校验和的区别：校验位用于数据录入（如条形码/ISBN 扫描），校验和用于传输后的数据）

## 章末 Summary（原文要点，中文辅助）

- Data is broken down into packets to be transmitted from one device to another.（数据分解为数据包在设备间传输）
- Each packet contains three parts: the packet header, the payload and the trailer.（每个数据包含三部分：包头、有效载荷与包尾）
- The packet header includes the destination address, the packet number and the originator's address.（包头含目的地址、包编号与源地址）
- The payload is the data the sender wants to transmit.（有效载荷是发送方要传输的数据）
- The trailer contains data such as the error detection method to be used.（包尾含所用的错误检测方法等信息）
- A process called packet switching can be used to send the data from one device to another across a network. Each packet can take an individual pathway controlled by routers; packets may arrive out of order and are reordered using packet numbers.（分组交换通过网络在设备间传输数据：每个包可由路由器选择独立路径；包可能乱序到达，用包编号重排）
- Data is transmitted using serial or parallel transmission.（数据用串行或并行方式传输）
- Data is also transmitted using simplex, half-duplex or full-duplex transmission.（数据传输还分单工、半双工或全双工）
- An interface called USB can be used to transmit data. This is often used to connect hardware such as a keyboard to a computer. USB uses a special high-speed serial connection.（USB 接口用于传输数据，常用于连接键盘等硬件到电脑；USB 使用特殊的高速串行连接）
- Errors can occur when transmitting data due to interference.（干扰会导致数据传输出错）
- Methods are required to detect any errors in transmission.（需要检测传输错误的方法）
- A parity check is an error detection method that uses a parity bit to detect errors. An odd or even parity check method can be used.（奇偶校验用校验位检测错误，可分奇校验或偶校验）
- A checksum is an error detection method that uses a calculated value to detect errors.（校验和用计算值检测错误）
- An echo check compares data that is sent and received to see if they match, to detect errors.（回显校验比较收发数据是否一致以检测错误）
- An ARQ can be used to monitor whether data is received correctly after transmission, using acknowledgement (positive or negative) and timeout.（ARQ 用确认（肯定/否定）与超时监控数据是否正确接收）
- A check digit is an error detection method that is used for data entry.（校验位用于数据录入的错误检测）
- Data can be encrypted to keep it secure during transmission. Encryption can be performed using a symmetric or asymmetric method.（数据可加密以保证传输安全；加密分对称与非对称两种）
- Symmetric encryption uses the same key to encrypt and decrypt the data.（对称加密用同一密钥加解密）
- Asymmetric encryption uses different keys, a public and a private key, to encrypt and decrypt the data. Encryption does not stop a hacker stealing data – it just makes the stolen data meaningless.（非对称加密用公钥与私钥两把不同密钥；加密不能阻止黑客窃取数据，只是让被窃数据变得无意义）

## 自查清单（SELF-EVALUATION，原文）

- Describe the structure of a packet of data（2.1）
- Describe the process of packet switching（2.2）
- Describe how data is transmitted using serial and parallel data transmission（2.3）
- Describe how data is transmitted using simplex, half-duplex and full-duplex data transmission（2.3）
- Choose a suitable data transmission for a given context and explain why that is the best method of data transmission（2.3）
- Describe how data is transmitted using the USB interface（2.4）
- Explain how errors can occur during data transmission（2.5）
- Describe how a parity check uses a parity bit to detect errors（2.5）
- Describe how a checksum value can be used to detect errors（2.5）
- Describe how an echo check compares data to detect errors（2.5）
- Describe how an ARQ can monitor if data is received correctly（2.5）
- Describe how a check digit can be used to detect errors involving data entry（2.5）
- Explain why data may need to be encrypted（2.6）
- Describe how data is encrypted using symmetric encryption（2.6）
- Describe how data is encrypted using asymmetric encryption（2.6）
