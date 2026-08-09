# Ch04 · Software（软件）

> 来源：Computer Science for Cambridge IGCSE & O Level Coursebook（Sarah Lawrey & Victoria Ellis，2nd ed）Chapter 4 正文
> 内容依据教材原文整理；定义取自教材 KEY WORDS 框，以课本为准；中文对照为辅助翻译。
> 配套 PDF：分章节/Ch04-Software.pdf

## 学习目标（Learning intentions 原文，中文辅助）

- explore the different types of software that run on computers（探索计算机上运行的不同类型软件）
- understand the role and function of an operating system in a computer（理解操作系统的角色与功能）
- explore the different types of programming language（探索不同类型的编程语言）
- describe and use the software used to write a computer program（描述并使用编写计算机程序的软件）
- learn about the software used to translate program code（学习用于翻译程序代码的软件）

## 关键词与原文定义（KEY WORDS）

| 关键词 (EN) | 原文定义（教材 KEY WORDS 框） | 中文对照 |
|-------------|--------------------------|----------|
| software | A series of instructions written in a programming language that performs a function. | 软件 |
| system software | A type of software that manages the hardware and software in a computer. | 系统软件 |
| operating system (OS) | A program that manages the computer, allows the user to communicate with the computer, and allows software to be run. | 操作系统 |
| utility programs | System software that performs housekeeping activities. | 实用程序 |
| application software | Software that allows the user to perform a useful task. | 应用软件 |
| word processor | A type of application software that allows the user to create text-based documents. | 文字处理软件 |
| spreadsheet | A type of application software that performs calculations on data. | 电子表格 |
| database | An example of application software to store and manipulate data. | 数据库 |
| web browser | A piece of software that retrieves and displays web pages. | 网页浏览器 |
| firmware | Instructions that are stored in the ROM and are loaded when the computer starts. | 固件 |
| bootstrap | The first commands loaded when a computer starts; it checks hardware and loads the firmware. | 引导程序 |
| interface | The method by which a user communicates with a computer. | 界面（接口） |
| Graphical User Interface (GUI) | A type of operating system that includes windows, icons, menus and pointers. | 图形用户界面 |
| command line interface | A type of operating system where the user types commands. | 命令行界面 |
| natural language interface | A type of operating system that allows the user to type or speak commands. | 自然语言界面 |
| peripheral | A hardware device, used to input, store or output data from a computer, that is not directly part of the computer itself. | 外设 |
| driver | A program that controls a device, for example, a printer or a keyboard. | 驱动程序 |
| interrupt | A signal sent to the processor to tell it that its attention is required. | 中断 |
| interrupt handler (IH) | A program that organises interrupts into an order based upon priorities. | 中断处理器 |
| interrupt service routine (ISR) | A program that retrieves an interrupt and performs the required action(s). | 中断服务程序 |
| high-level language | A type of programming language that uses English-like commands. | 高级语言 |
| low-level language | A language closer to the machine's language; this could be assembly language or binary code. | 低级语言 |
| portable | A program that can be run on different types and manufacturers of computers. | 可移植 |
| machine code | Binary code, an example of a low-level language. | 机器码 |
| assembly language | Code written in mnemonics that allows direct manipulation of the hardware. It must be converted into binary code to run. | 汇编语言 |
| non portable | A program that cannot be run on different types and manufacturers of computers. | 不可移植 |
| mnemonic | Instruction code used in assembly language. | 助记符 |
| translator | A type of software that converts code written in one programming language into another, usually a high-level language into a low-level language. | 翻译器 |
| assembler | Converts assembly language into machine code. | 汇编器 |
| interpreter | A translator that converts a high-level language into a low-level language. It checks one line of code and then executes it before checking the next. | 解释器 |
| compiler | A translator that converts a high-level language into a low-level language. It checks all code before running the program. | 编译器 |
| executable file | A file produced by a compiler that can be run independent of translator software and does not include the source code. | 可执行文件 |
| Integrated Development Environment (IDE) | A piece of software that allows a user to write, test and run program code. | 集成开发环境 |
| editor | A feature of an IDE that allows the user to enter and amend program code. | 编辑器 |
| auto-completion | A feature of an editor that gives the user options when they start typing a command. | 自动补全 |
| auto-correction | A feature of an editor that identifies spelling errors and changes them. | 自动更正 |
| prettyprint | A feature of an editor that changes the colour of text, for example, to highlight key words. | 美化排版（语法着色） |
| run-time environment | A feature of an IDE that allows a program to be run and lets the user interact with the program. | 运行时环境 |

## 技能重点（SKILLS FOCUS，需掌握的重要能力）

### SKILLS FOCUS 4.1 Justifying choice（论证选择：解释器 vs 编译器）
- **内容 Content**: In an exam you may need to make a decision and then justify your choice – relate every reason back to the scenario. Interpreter is most useful during development: you can fix errors in real time; the program will stop at each error to allow you to fix it; you can run small sections of the program when incomplete. A compiler is most useful when a program is complete: it produces a .exe file; the program does not need to be interpreted each time it is run; the program can be distributed without the source code.（考试中做选择并论证时必须把每个理由联系回场景：写程序阶段用解释器——可实时修错、停在每个错误处、能运行未完成的小段代码；程序完成时用编译器——产生 .exe 可执行文件、运行无需每次重新翻译、可分发而无需提供源代码）
- **要点 Key points**: 解释器=逐行翻译执行、立即报错、适合开发调试；编译器=全部检查后生成可执行文件、适合发布（中文要点）

## 活动与编程任务（ACTIVITY，英文原文为主、中文辅助）

### ACTIVITY 4.1 Listing application software（列出应用软件）
- **内容 Content**: Log onto a computer, tablet or mobile phone. Make a list of the different types of application software that are installed. Remember not to use brand names.（登录电脑/平板/手机，列出已安装的不同类型应用软件（用通用名而非品牌名））

### ACTIVITY 4.2 Operators and operands（操作码与操作数）
- **内容 Content**: Assembly language instructions are split into operators and operands. Find out what an operator and an operand is. Find some examples of each.（汇编语言指令分为操作码与操作数；查明二者含义并举例）

### ACTIVITY 4.3 Interpreter vs compiler experience（解释器与编译器体验）
- **内容 Content**: Write a computer program in a language that uses an interpreter, and one that uses a compiler. You might need to use a different programming language for each one (e.g. Python usually has interpreters, whilst VB.NET and Java usually have compilers). Which translator did you prefer to use? Peer assessment: discuss the reasons why you preferred the translator you chose.（分别用解释型语言与编译型语言写程序（如 Python 用解释器、VB.NET/Java 用编译器），比较更喜欢哪种翻译器并互评理由）

### ACTIVITY 4.4 Exploring an IDE（探索 IDE 功能）
- **内容 Content**: Open up the IDE that you use to write programs. Identify the features that are mentioned in this chapter (editor, auto-completion, auto-correction, prettyprint, block minimising, translator, run-time environment, break points, variable watch window, stepping). Are there any different ones? If so, find out what these do.（打开自己使用的 IDE，识别本章提到的功能；如有其他功能，查明其作用）

## 章末 Summary（原文要点，中文辅助）

- Software is created using programming languages.（软件由编程语言编写而成）
- Two types of software are application and system software.（软件分应用软件与系统软件两类）
- The Operating System performs many functions including memory management, handling interrupts and providing an interface.（操作系统执行许多功能：内存管理、处理中断、提供界面等）
- An interrupt is a signal sent to the processor to get its attention.（中断是发给处理器请求注意的信号）
- A high-level language uses English-like terms that need translating before it can run and a low-level language is assembly or machine code.（高级语言用类英语术语、运行前需翻译；低级语言是汇编或机器码）
- Assembly language is turned into machine code using an assembler.（汇编语言用汇编器转为机器码）
- High-level languages are turned into a low-level language using a compiler or interpreter.（高级语言用编译器或解释器转为低级语言）
- An IDE helps the user write, test and run program code.（IDE 帮助用户编写、测试和运行程序代码）
- The application software runs on the operating system, this runs on the firmware, and it is loaded by the bootstrap.（应用软件运行在操作系统上，操作系统运行在固件上，固件由引导程序加载）

## 自查清单（SELF-EVALUATION，原文）

- Describe the difference between application and system software（4.1）
- Describe the role and basic functions of an operating system（4.2）
- Describe how hardware, firmware and an operating system are required to run application software（4.2）
- Describe the role and operation of interrupts（4.3）
- Describe the characteristics, advantages and disadvantages, of high-level and low-level languages（4.4）
- Describe the use of an assembler, compiler and interpreter（4.5）
- Describe the advantages and disadvantages of a compiler and an interpreter（4.5）
- Describe the use of, and features of, an IDE（4.6）
