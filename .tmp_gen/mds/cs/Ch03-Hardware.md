# Ch03 · Hardware（硬件）

> 来源：Computer Science for Cambridge IGCSE & O Level Coursebook（Sarah Lawrey & Victoria Ellis，2nd ed）Chapter 3 正文
> 内容依据教材原文整理；定义取自教材 KEY WORDS 框，以课本为准；中文对照为辅助翻译。
> 配套 PDF：分章节/Ch03-Hardware.pdf

## 学习目标（Learning intentions 原文，中文辅助）

- develop an understanding of the role of the central processing unit (CPU) in a computer, including the fetch-decode-execute cycle（理解 CPU 在计算机中的作用，包括取指-译码-执行周期）
- learn the role of each of the components in a CPU that has a Von Neumann architecture（学习冯·诺依曼体系结构 CPU 中各组件的作用）
- develop an understanding of what an embedded system is and be able to identify devices in which they are used（理解什么是嵌入式系统并能识别使用它的设备）
- understand what an input device and an output device is and why they are needed（理解输入设备与输出设备是什么及为何需要）
- learn the role of a sensor and the purpose of a range of different sensors, including how they capture data（学习传感器的作用及多种传感器的用途，包括它们如何采集数据）
- learn the role of random access memory (RAM) and read only memory (ROM)（学习 RAM 与 ROM 的作用）
- learn the role of secondary storage including the operation of the different types（学习辅助存储的作用及各类型的运作方式）
- develop an understanding of virtual memory and how it is created（理解虚拟内存及其创建方式）
- learn how cloud storage is used and the advantages and disadvantages of storing data in the cloud（学习云存储的使用及云端存储数据的优缺点）
- study the main components and types of address that are used when connecting a computer to a network（研究计算机联网时使用的主要组件与地址类型）

## 关键词与原文定义（KEY WORDS）

| 关键词 (EN) | 原文定义（教材 KEY WORDS 框） | 中文对照 |
|-------------|--------------------------|----------|
| Internet of Things | The connection of computer systems and everyday devices, using the internet, to allow data to be exchanged. | 物联网 |
| central processing unit (CPU) | A component in a computer system that processes data and instructions. | 中央处理器 |
| microprocessor | An integrated circuit that is able to perform many of the functions of a CPU. | 微处理器 |
| embedded system | A computer system that performs a dedicated function. | 嵌入式系统 |
| fetch-decode-execute cycle | The cycle through which data and instructions are processed. | 取指-译码-执行周期 |
| architecture | The design of a computer system, including the components it contains. | 体系结构 |
| input device | A device that allows data to be entered into a computer system. | 输入设备 |
| RAM (random access memory) | A component in the CPU that holds data and programs that are currently in use. | 随机存取存储器 |
| hard drive | A storage device that stores data permanently, until it is deleted by the user. | 硬盘 |
| program counter (PC) | A component in the CPU that stores the address of the next instruction to be processed. | 程序计数器 |
| address | A memory location in RAM. | 地址 |
| memory address register (MAR) | A component in the CPU that holds the address of the data or instruction to be located in RAM. | 内存地址寄存器 |
| address bus | Wires used for the transmission of addresses between components in a computer. | 地址总线 |
| memory data register (MDR) | A component in the CPU that holds the data or instruction that are fetched from RAM. | 内存数据寄存器 |
| data bus | Wires used for the transmission of data and instructions between components in a computer. | 数据总线 |
| current instruction register (CIR) | A register that is built into the CU that holds the current instruction that is being processed in the CPU. | 当前指令寄存器 |
| control unit (CU) | The component in the CPU that controls all the operations in the CPU. | 控制单元 |
| instruction set | A set of commands that can be processed by a certain CPU. | 指令集 |
| arithmetic logic unit (ALU) | The component in the CPU that performs all the mathematical and logical operations required when processing data and instructions. | 算术逻辑单元 |
| accumulator (ACC) | A register that is built into the ALU that stores the result of any interim calculations. | 累加器 |
| control bus | Wires used for the transmission of control signals between components in a computer. | 控制总线 |
| core | The part of the CPU that contains all the components that are used to perform the fetch-decode-execute cycle. | 核心 |
| clock speed | The number of fetch-decode-execute cycles that can be performed in a second. | 时钟速度 |
| cache | A type of storage that is built into the CPU, to store the most frequently used data and instructions. | 高速缓存 |
| output device | A device that can be used to obtain the results of data that has been processed. | 输出设备 |
| sensor | A type of input device that is used to capture data from its immediate environment. | 传感器 |
| automated system | A system that is designed to operate without the need for any human intervention. | 自动化系统 |
| primary storage | A type of storage that is directly accessed by the CPU. | 主存储 |
| secondary storage | A type of storage that is designed to store data permanently, until it is deleted by the user. | 辅助存储 |
| ROM (read only memory) | A type of primary storage that stores the start up instruction for the computer. | 只读存储器 |
| magnetic storage | A type of secondary storage that uses the properties of magnetism to store data. | 磁存储 |
| optical storage | A type of secondary storage that uses lasers to store data. | 光存储 |
| solid-state storage | A type of secondary storage that uses transistors to store data. | 固态存储 |
| semiconductor chips | An electronic circuit, where transistors are set on a semiconductor material, such as silicon. | 半导体芯片 |
| cell | The intersection of the rows and columns of transistors in solid-state storage. | 存储单元 |
| transistor | A device that acts as a switch or gate for electronic signals. | 晶体管 |
| control gate | A component that controls the flow of electric current. | 控制栅 |
| floating gate | A component that can store electrical charge. | 浮栅 |
| virtual memory | A type of memory that can be used as an extension to the RAM. | 虚拟内存 |
| page | A unit of data. | 页（数据单位） |
| cloud storage | Data storage that is owned by a third party and accessed by the user, using the internet. | 云存储 |
| server | A component that acts as a central resource for the storage of data and applications or for providing a service. | 服务器 |
| network | Computers and devices that are joined together using cables or wireless technology. | 网络 |
| network interface card (NIC) | The component in a computer that is used to connect it to a network. | 网卡 |
| transmission media | The cables that are used to transfer data in a network. | 传输介质 |
| media access control (MAC) address | The unique address that is given to a NIC by the manufacturer. | MAC 地址 |
| data packet | A unit of data that is used to transmit data across a network. | 数据包 |
| router | A network component that examines a data packet to obtain its destination address and then forwards the packet to this address. | 路由器 |
| static IP | An IP address that does not change each time the device connects to a network. | 静态 IP |
| dynamic IP | An IP address that can change each time the device connects to a network. | 动态 IP |

## 技能重点（SKILLS FOCUS，需掌握的重要能力）

（本章技能重点由 ACTIVITY 3.1-3.12 组成，核心能力为：能画出并标注取指-译码-执行周期各阶段（3.2/3.3）、能按场景选择合适传感器（3.6）、能描述三种辅助存储的读写原理（3.7）。）

### 取指-译码-执行周期全过程（The fetch-decode-execute cycle）
- **内容 Content**: Fetch stage: the program counter (PC) stores the address of the next instruction; the address is sent via the address bus to the memory address register (MAR), which sends it to the location in RAM; the instruction at that location is sent via the data bus to the memory data register (MDR), then to the current instruction register (CIR) in the control unit (CU). Decode stage: the CU decodes the instruction using the instruction set (machine code commands understood by the CPU). Execute stage: actions are carried out – mathematical and logical calculations are done in the ALU, with interim values stored in the accumulator (ACC); the CU sends signals to all components using the control bus.（取指阶段：PC 存下一条指令地址 → 经地址总线送 MAR → MAR 送地址到 RAM 对应位置 → 该位置指令经数据总线送 MDR → 再送 CU 中的 CIR；译码阶段：CU 用指令集（CPU 能理解的机器码命令集）译码；执行阶段：执行动作——数学与逻辑运算在 ALU 中进行，中间值存于 ACC；CU 用控制总线向所有组件发信号）
- **要点 Key points**: 三条总线分工：地址总线传地址、数据总线传数据/指令、控制总线传控制信号；寄存器速记：PC 存下一条地址、MAR 存要访问的地址、MDR 存取回的指令、CIR 存当前指令、ACC 存运算中间值（中文要点）

### 传感器选型能力（Choosing a sensor for a scenario）
- **内容 Content**: Sensors capture analogue data from the environment at set time intervals. Types to know: acoustic (sound level – security), accelerometer (acceleration forces – screen rotation, earthquake detection, airbags), flow (liquid/gas/steam flow – factories, nuclear plants), gas (presence/concentration of gas – carbon monoxide alarms), humidity (moisture in air – greenhouses, art galleries), infra-red (infra-red radiation – security systems), level (whether a substance is at a certain level – oil/fuel in cars), light (ambient light – streetlights), magnetic field (magnetic field presence – counting cars), moisture (water in soil – agriculture), pH (pH level – pollution monitoring), pressure (force of pressure – security on windows/doors), proximity (how close an object is – robots in manufacturing), temperature (temperature of object/substance – air conditioning).（传感器按设定时间间隔从环境采集模拟数据；需掌握 14 种传感器：声学、加速度计、流量、气体、湿度、红外、液位、光、磁场、水分、pH、压力、接近、温度——每种的数据类型与应用场景见正文）
- **要点 Key points**: 传感器是输入设备；选择时看场景需要采集的物理量（如监测污染用 pH、检测入侵者用红外/压力/声学、测土壤水分用 moisture）（中文要点）

### 三种辅助存储的读写原理（How data is written to and read from magnetic, optical and solid-state storage）
- **内容 Content**: Magnetic storage (e.g. hard disk drive): circular platters spin, separated into tracks and sectors; a read/write head moves across the platters; an electromagnet magnetises dots – magnetised dot = binary 1, demagnetised = 0. Optical storage (CD/DVD/Blu-ray): a laser burns pits into the surface of the disk in a spiral track starting at the centre; the surface between pits is called a land; a laser reads the pits and lands. Solid-state storage (SSD, USB flash drive): no moving parts; made of semiconductor chips with cells and transistors laid out in a grid (NOR = parallel, NAND = series); each cell has a control gate and a floating gate; transistors start at 1 and are set to 0 when data is stored.（磁存储（如硬盘）：盘片旋转、分为磁道与扇区，读写头移动，电磁铁磁化圆点——磁化 = 1、未磁化 = 0；光存储（CD/DVD/蓝光）：激光在盘面烧出凹坑（pit）成从中心开始的螺旋轨道，坑间平面称 land，用激光读坑与平面；固态存储（SSD、U 盘）：无活动部件，半导体芯片上晶体管网格排列（NOR 并联、NAND 串联），每单元有控制栅与浮栅，晶体管初始为 1、存数据时置 0））
- **要点 Key points**: 磁存储有活动部件（怕摔、磨损）；光存储用激光读写；固态存储无活动部件、速度快但无机械结构（中文要点）

### 输入输出设备清单（Input and output devices）
- **内容 Content**: An input device is any device that allows data to be entered into a computer system; the data could take many forms including text, images and sound. Common input devices: barcode scanner (scans a barcode so the data stored in it can be obtained – used in a supermarket to get the price of a product and as part of a stock control system), digital camera, keyboard, microphone, optical mouse, QR code scanner, scanner (2D and 3D), touch screen (resistive, capacitive and infra-red). An output device is any device that allows the result of the data processing to be seen or heard. Common output devices: actuator (outputs an action, often a type of movement, that causes another device to operate – used in an automated system to move or turn on/off another device, e.g. a light), digital light processing (DLP) projector, inkjet printer, laser printer, light emitting diode (LED) screen, liquid crystal display (LCD) projector, liquid crystal display (LCD) screen, speaker, 3D printer.（输入设备是允许数据（文本/图像/声音等）进入计算机系统的设备：条形码扫描器（扫描条形码获取数据——超市定价与库存控制）、数码相机、键盘、麦克风、光电鼠标、QR 码扫描器、扫描仪（2D/3D）、触摸屏（电阻式/电容式/红外式）；输出设备是允许看到或听到处理结果的设备：执行器（输出动作（多为移动），使另一设备运转——自动化系统中开关另一设备如灯）、DLP 投影仪、喷墨打印机、激光打印机、LED 屏、LCD 投影仪、LCD 屏、扬声器、3D 打印机）
- **要点 Key points**: 按“允许输入的数据类型 + 使用场景”掌握每种设备；actuator 既是输出设备又是自动化系统的关键部件（中文要点）

## 活动与编程任务（ACTIVITY，英文原文为主、中文辅助）

### ACTIVITY 3.1 Von Neumann research（冯·诺依曼研究）
- **内容 Content**: Use the internet to research who Von Neumann was and why he developed the Von Neumann architecture.（上网研究冯·诺依曼是谁及他为何提出冯·诺依曼体系结构）

### ACTIVITY 3.2/3.3 Fetch-decode-execute diagrams（取指-译码-执行图示）
- **内容 Content**: 3.2: Draw a diagram like Figure 3.4 to see if you can draw and label the process for the fetch stage of the cycle. 3.3: Add the ALU and the ACC to your diagram then label it to show the process for the decode and execute stages of the cycle. Peer assessment: exchange diagrams with a friend and use the description of the fetch-execute-decode cycle to check whether their diagram is correct.（3.2 画图标注取指阶段流程；3.3 加入 ALU 与 ACC 标注译码与执行阶段；与同学交换互评）

### ACTIVITY 3.4 Multiple cores（多核性能研究）
- **内容 Content**: The performance of a CPU is not always increased by the addition of more cores. Use the internet to find out why the performance may not always be increased.（增加核心数不一定提升性能；上网研究原因）

### ACTIVITY 3.5 Overclocking（超频）
- **内容 Content**: It is possible to change the speed of a CPU using overclocking. Use the internet to find out what is meant by overclocking.（上网了解什么是超频）

### ACTIVITY 3.6 Types of RAM and ROM（RAM 与 ROM 的类型）
- **内容 Content**: There are also different types of RAM and ROM. You do not need to know what these are for the exam, but it is interesting to find out what they are. Use the internet to research the different types of RAM and ROM and when they are used.（上网研究 RAM 与 ROM 的不同类型及用途；考试不作要求）

### ACTIVITY 3.7 Magnetic storage research（磁存储研究）
- **内容 Content**: There are older types of magnetic storage called magnetic tape and floppy disks. What can you find out about them? Can you also find out what the largest storage capacity is for a hard disk drive?（研究磁带与软盘等较老的磁存储，以及硬盘的最大存储容量）

### ACTIVITY 3.9 Another solid-state device（固态存储设备举例）
- **内容 Content**: You have learnt that a solid state drive and a USB flash memory drive are examples of solid state storage. Can you think of another example?（除 SSD 与 U 盘外，再举一个固态存储设备例子）

### ACTIVITY 3.10 Cloud storage discussion（云存储讨论）
- **内容 Content**: Do you store any data in cloud storage? If so, do you ever worry about doing this? Discuss with a partner the advantages and disadvantages of storing data in the cloud compared to local storage, research at least one more advantage and one more disadvantage, and reach a conclusion about whether you think the risk is worth it.（讨论云存储与本地存储的优缺点，补充研究至少一个优点与一个缺点，得出结论并全班分享）

### ACTIVITY 3.11 Finding a MAC address（查找 MAC 地址）
- **内容 Content**: See if you can find out the MAC address of one of your devices, such as a computer, laptop or a mobile phone. If you do not know how to find it, you can use the internet to find a tutorial.（查找自己某台设备（电脑/笔记本/手机）的 MAC 地址，不会可上网找教程）

### ACTIVITY 3.12 Static IP research（静态 IP 研究）
- **内容 Content**: Can you find out what kind of devices a static IP address is normally used for? Can you also find out what the benefit is of having a static IP address?（研究静态 IP 通常用于什么设备、有何好处）

## 章末 Summary（原文要点，中文辅助）

- Hardware is all the physical components that you can see and touch in a computer system.（硬件是计算机系统中所有看得见、摸得着的物理组件）
- The CPU is the component in a computer system that processes all the instructions and data. It uses an instruction set to do this.（CPU 处理所有指令与数据，使用指令集执行）
- The CPU has several component parts, these include the ALU, CU, PC, MAR, MDR, CIR, ACC and buses.（CPU 含 ALU、CU、PC、MAR、MDR、CIR、ACC 与总线等组件）
- The CPU is responsible for carrying out the fetch-decode-execute cycle.（CPU 负责执行取指-译码-执行周期）
- The number of cores, the clock speed and the cache size can all affect the performance of the CPU.（核心数、时钟速度与缓存大小都会影响 CPU 性能）
- Computers also need input and output devices to be able to provide a system with data, then obtain the results when it has been processed.（计算机需要输入/输出设备来输入数据并获取处理结果）
- Sensors are a type of input device that can be used to capture data from the immediate surrounding environment.（传感器是采集周边环境数据的输入设备）
- A computer has both primary and secondary storage. Primary storage is directly accessed by the CPU and consists of RAM and ROM.（计算机有主存储与辅助存储；主存储直接被 CPU 访问，含 RAM 与 ROM）
- Secondary storage is not directly accessed by the CPU and there are three types, magnetic, optical and solid-state.（辅助存储不被 CPU 直接访问，分磁、光、固态三种）
- Virtual memory is created by partitioning part of the hard drive. It is used when RAM is full.（虚拟内存由划分硬盘部分空间创建，RAM 满时使用）
- Cloud storage is when data is stored remotely on servers and storage that is owned and maintained by a third party.（云存储是把数据存储在第三方拥有和维护的远程服务器上）
- A network is created when two or more devices are connected.（两个以上设备相连即构成网络）
- A device needs a NIC to connect to a network. Each NIC has a MAC address.（设备需要网卡联网，每张网卡有 MAC 地址）
- A router is used in a network to forward packets of data to their correct destination. A router can assign an IP address to each device.（路由器把数据包转发到正确目的地，可为每台设备分配 IP 地址）
- There are two types of IP address, IPv4 and IPv6.（IP 地址分 IPv4 与 IPv6 两种；IPv4 用 32 位、IPv6 用 128 位）

## 自查清单（SELF-EVALUATION，原文）

- Explain why a computer system needs a CPU（3.1）
- Describe the role of each component in a CPU（3.1）
- Explain how data is fetched into the CPU, including the components used（3.2）
- Explain how data is decoded and executed by the CPU, including the components used（3.3）
- Explain what an embedded system is and identify examples of where one might be used（3.1）
- Describe the purpose of an input device and provide examples（3.6）
- Describe the purpose of an output device and provide examples（3.6）
- Identify the different types of data that is captured by different sensors（3.6）
- Choose a suitable sensor for a given scenario（3.6）
- Give characteristics of primary storage and explain the role of RAM and ROM（3.7）
- Give characteristics of secondary storage（3.7）
- Describe how data is written to and read from magnetic storage（3.7）
- Describe how data is written to and read from optical storage（3.7）
- Describe how data is written to and read from solid-state storage（3.7）
- Explain how virtual memory is created and when it is needed in a computer system（3.8）
- Describe what cloud storage is and how it is used（3.9）
- Explain the advantages and disadvantages of storing data in the cloud, rather than storing it locally（3.9）
