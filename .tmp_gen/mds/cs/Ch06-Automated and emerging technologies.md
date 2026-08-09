# Ch06 · Automated and emerging technologies（自动化与新兴技术）

> 来源：Computer Science for Cambridge IGCSE & O Level Coursebook（Sarah Lawrey & Victoria Ellis，2nd ed）Chapter 6 正文
> 内容依据教材原文整理；定义取自教材 KEY WORDS 框，以课本为准；中文对照为辅助翻译。
> 配套 PDF：分章节/Ch06-Automated and emerging technologies.pdf

## 学习目标（Learning intentions 原文，中文辅助）

- learn about the use of automated systems in context（学习自动化系统在具体场景中的使用）
- explore how automated systems use sensors, microprocessors and actuators（探索自动化系统如何使用传感器、微处理器与执行器）
- explore the advantages and disadvantages of automated systems in context（探索自动化系统在具体场景中的优缺点）
- learn about the use of robotics（学习机器人的使用）
- learn about the characteristics of a robot（学习机器人的特征）
- explore the use of robots in context（探索机器人在具体场景中的使用）
- learn about what is meant by artificial intelligence（学习人工智能的含义）
- explore the characteristics of artificial intelligence systems（探索人工智能系统的特征）
- describe the use of machine learning in artificial intelligence（描述机器学习在人工智能中的使用）
- explore the features of, and use of, expert systems（探索专家系统的特征与使用）

## 关键词与原文定义（KEY WORDS）

| 关键词 (EN) | 原文定义（教材 KEY WORDS 框） | 中文对照 |
|-------------|--------------------------|----------|
| automated | A device that is operated without human interaction. | 自动化的 |
| sensor | A type of input device that is used to capture data from its immediate environment. | 传感器 |
| microprocessor | An integrated circuit that is able to perform many of the functions of a CPU. | 微处理器 |
| analogue | Continuous data that can be any value within a range. | 模拟（数据） |
| digital | Discrete data that is stored as 1s and 0s. | 数字（数据） |
| actuator | A mechanical part that causes another device or part to move. | 执行器 |
| automation | The use of automated equipment in a process, e.g. a factory. | 自动化 |
| robot | A machine that replicates human actions or movement. | 机器人 |
| robotics | An area of computer science that looks at the creation and use of robots. | 机器人学 |
| programmable | A computer that will run the commands stored in it. | 可编程的 |
| artificial intelligence (AI) | A part of computer science that looks at creating machines that can think and perform tasks a person would usually perform. | 人工智能 |
| machine learning | A computer program that can adapt its stored rules or processes. | 机器学习 |
| expert system | A system that attempts to replicate the knowledge of an expert. | 专家系统 |
| knowledge base | Part of an expert system that stores the facts. | 知识库 |
| rule base | Part of an expert system that stores the rules based upon the knowledge. | 规则库 |
| inference engine | Part of an expert system that makes the decisions. | 推理引擎 |
| user interface | (In the context of expert systems) the part that outputs questions and statements to the user, and allows the user to enter data. | 用户界面 |

## 技能重点（SKILLS FOCUS，需掌握的重要能力）

### SKILLS FOCUS 6.1 Control and monitoring systems（控制与监控系统：输入-处理-输出）
- **内容 Content**: When considering a control or monitoring system you need to determine the inputs, processes and outputs as you would in a computer program: inputs from the sensors; the processes; the outputs from the system. Then create the 'story' about how the sensors gather the appropriate data, what this is compared to, and how this influences the outputs. Example – automatic door: Inputs: a pressure sensor detects if a person is standing on a specific point; a motion or infra-red sensor detects if a person is in a specific place. Processes: analogue data from the sensor is converted to digital; the microprocessor stores the value where a person is detected. Output: a signal goes to an actuator to open the door, which stays open for 5 seconds and is reset each time another person is detected.（分析控制/监控系统时需像程序一样确定输入（传感器数据）、处理与输出；再构建"故事"说明传感器如何采集数据、与什么比较、如何影响输出；例题——自动门：输入为压力/运动/红外传感器检测人；处理为模拟转数字、微处理器与存储值比较；输出为执行器开门的信号（保持 5 秒、检测到人即重置））
- **要点 Key points**: 传感器只读环境不处理数据；模拟数据须经模数转换器转成数字后才送微处理器；微处理器把读数与预存值比较，超范围才发信号给执行器；循环持续到系统关闭（中文要点）

### 自动化/机器人的场景评估框架（Evaluating automation/robotics in context）
- **内容 Content**: When evaluating the use of automation you can consider: initial cost, running cost, safety, replacing people's jobs, continuous work all day every day, precision. Example – industry (car manufacturing): high initial cost (robots + software); running cost high (maintenance) but more efficient, fewer employees saves money long-term; safer (systems can monitor environment and stop, humans get distracted); jobs lost but new jobs made to maintain the system; continuous work means more cars built; no human errors so fewer faulty cars. Example – science (nuclear power plant): high initial cost; lower running cost (fewer people) but maintenance may be expensive; less risk of human error, people do not work in dangerous places; monitoring continues all day every day without getting tired; precision important in high-risk scenarios. Example – agriculture (greenhouse): high-ish installation/programming cost; small system so running cost not high; safety may not be relevant; may replace monitoring jobs but unlikely to be a large number; adapts as soon as there is a problem; more accurate readings and instant changes.（评估自动化/机器人时考虑六要素：初始成本、运行成本、安全性、替代人工、全天候持续工作、精度；教材给出工业（汽车制造）、科学（核电站）、农业（温室）三个场景的逐项分析——考试需结合具体场景作答）
- **要点 Key points**: 优缺点必须联系场景（如核电站强调安全与精度、温室强调即时调整）；机器人替代工作但也创造维护新岗位（中文要点）

## 活动与编程任务（ACTIVITY，英文原文为主、中文辅助）

### ACTIVITY 6.1 Robots research（机器人调研）
- **内容 Content**: Find more examples of robots that are used in each of the sections: medicine, agriculture, transport, industry, entertainment and domestic. List the benefits and drawbacks of each of the robots. Share your findings with the class and see how many different robots you have all found.（在医学、农业、交通、工业、娱乐与家用六类中各找更多机器人例子，列出每种的优缺点并全班分享）

### ACTIVITY 6.2 AI programs discussion（AI 程序讨论）
- **内容 Content**: Identify any programs you have used that might make use of artificial intelligence. This could be computer games where you play against the computer, or natural language interfaces. Discuss how you think these may have been programmed and how the problems can be simplified into smaller parts to make the task easier to tackle.（找出自己用过的可能使用 AI 的程序（与电脑对战的游戏、自然语言界面等），讨论它们如何被编程以及如何把问题分解为更小的部分）

### ACTIVITY 6.3 Computer game analysis（电脑游戏分析）
- **内容 Content**: Find and play a computer game where you are competing against the computer. Discuss how you think the computer's character was controlled. Did it just repeat the same movements over and over, or did it change what it did based on your move? Discuss how you think it was created and programmed.（玩一个与电脑对战的游戏，分析电脑角色是如何控制的：是重复相同动作还是根据你的走法改变？讨论其创建与编程方式）

### ACTIVITY 6.4 Building an expert system（构建专家系统）
- **内容 Content**: Create an expert system to determine the difference between a cat and a dog. Ask the user questions depending on their previous answers. This can be written as a computer program using a programming language of your choice, or as a flowchart showing which questions to move to depending on each answer. Peer assessment: test each other's expert systems. How useable was the system? Were there any questions that you couldn't answer? Did it give you the correct answer?（构建判断猫狗区别的专家系统：根据用户回答决定下一个问题，可用编程语言实现或画成流程图；互测系统可用性、能否回答、是否给出正确答案）

## 章末 Summary（原文要点，中文辅助）

- An automated system performs actions without human intervention.（自动化系统无需人工干预即可执行动作）
- An automated system has sensors, a microprocessor and actuators.（自动化系统由传感器、微处理器与执行器组成）
- Robotics is the creation and management of machines that perform actions that humans perform.（机器人学是创造与管理执行人类动作的机器）
- A robot contains a mechanical structure, electrical components including parts of an automated system, and it can be programmed to perform specific actions.（机器人含机械结构、电气组件（自动化系统部件）且可编程执行特定动作）
- Robots can be found in a range of areas, for example, medicine and transport, and have advantages and disadvantages in each context.（机器人用于医学、交通等多个领域，每个场景各有优缺点）
- Artificial intelligence is an area of computer science that aims to develop systems that mimic human intelligence.（人工智能是计算机科学中旨在开发模拟人类智能系统的领域）
- Machine learning is one area of artificial intelligence where a program can amend its own data and algorithms.（机器学习是 AI 的一个领域：程序可修改自己的数据与算法）
- An expert system attempts to simulate a human expert in a specific area.（专家系统试图模拟特定领域的人类专家）
- An expert system is made up of a knowledge base, rule base, inference engine and interface.（专家系统由知识库、规则库、推理引擎与界面组成）

## 自查清单（SELF-EVALUATION，原文）

- Describe what an automated system is（6.1）
- Describe the hardware used within an automated system（6.1）
- Describe the role of sensors, microprocessors and actuators used in automated systems（6.1）
- Describe the advantages and disadvantages of an automated system in a given scenario（6.1）
- Define the term robotics（6.2）
- Give examples of the use of robotics（6.2）
- Describe the characteristics of a robot（6.2）
- Describe the advantages and disadvantages of robotics in a given scenario（6.3）
- Define the term artificial intelligence（6.4）
- Describe the main characteristics of an AI system（6.4）
- Describe machine learning（6.4）
- Describe the key features of an expert system（6.4）
- Describe the use of an expert system for a given scenario（6.4）
