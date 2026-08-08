# Ch10 · Boolean logic（布尔逻辑）

> 来源：Computer Science for Cambridge IGCSE & O Level Coursebook（Sarah Lawrey & Victoria Ellis，2nd ed）Chapter 10 正文
> 内容依据教材原文整理；定义取自教材 KEY WORDS 框，以课本为准；中文对照为辅助翻译。
> 配套 PDF：分章节/Ch10-Boolean logic.pdf

## 学习目标（Learning intentions 原文，中文辅助）

- know the standard symbols for a range of different logic gates（知道各种逻辑门的标准符号）
- understand the function of each different logic gate（理解每种逻辑门的功能）
- represent a logic circuit using a truth table and a logic expression（用真值表与逻辑表达式表示逻辑电路）
- represent a truth table as a logic expression and a logic circuit（把真值表表示为逻辑表达式与逻辑电路）
- represent a logic expression as a logic circuit and a truth table（把逻辑表达式表示为逻辑电路与真值表）
- represent a problem statement as a logic expression, logic circuit and a truth table（把问题陈述表示为逻辑表达式、逻辑电路与真值表）

## 关键词与原文定义（KEY WORDS）

| 关键词 (EN) | 原文定义（教材 KEY WORDS 框） | 中文对照 |
|-------------|--------------------------|----------|
| voltage | The pressure that forces the charged electrons to flow in an electrical circuit. | 电压 |
| logic gate | A very small component in a computer system that controls the flow of electricity. | 逻辑门 |
| truth table | A method to show all the different outcomes of an electrical circuit or system, dependent on the inputs it receives. | 真值表 |
| logic expression | A mathematical representation that is used to represent an electrical circuit or system. | 逻辑表达式 |

## 技能重点（SKILLS FOCUS，需掌握的重要能力）

### SKILLS FOCUS 10.1 Representing logic circuits（用真值表表示逻辑电路）
- **内容 Content**: A logic circuit is a combination of several logic gates that are linked. To complete a truth table for a circuit with three inputs (A, B, C), there are 8 combinations – the rows increment like 3-bit binary values from 000 (= 0) to 111 (= 7). Give interim labels (e.g. D = output of the OR gate, E = output of the NOT gate) so values are easier to track. Complete each column in turn: fill D from the OR gate (inputs A and B only – ignore C); fill E from the NOT gate (input C only); then fill the final output Y from the AND gate (inputs D and E only).（组合逻辑电路的真值表：三输入有 8 种组合（行序如同 3 位二进制从 000 递增到 111）；给中间节点加标签（如 D = OR 输出、E = NOT 输出）便于追踪；逐列填写——先算各门的输出列，最后算总输出列）
- **要点 Key points**: 每列只看该门的两个输入（忽略无关列）；8 行组合按二进制递增顺序排列（中文要点）

### 从逻辑电路写逻辑表达式（Writing a logic expression for a circuit）
- **内容 Content**: Break down the logic circuit into its different parts, then join them together. Always start with the label for the final output followed by an equals symbol (Y =). Add the final gate in the logic circuit (everything else is built around this), then add the part that creates the first input to this gate (put it in brackets to show it is a different part), then the second input. Example: Y = (A OR B) AND (NOT C). For a larger circuit: Z = ((P NAND Q) XOR (NOT Q)) AND R.（先把电路拆成各部分，再从最终输出开始写（Y =），先写最后一级的门，再依次填入其两个输入（用括号分隔各部分）；例：Y = (A OR B) AND (NOT C)；复杂电路从右往左逐层展开）
- **要点 Key points**: 从最终输出门开始从右向左；每个门的输入部分用括号包裹（中文要点）

### 从真值表写逻辑表达式与画电路（From truth table to expression and circuit）
- **内容 Content**: First check whether the truth table matches any single logic gate you know; if not, it must be a combination of at least two gates (you only need NOT, AND and OR for this). Method: focus on the rows where the output is 1. For each such row, use an AND gate: an input value of 1 stays as the letter (e.g. A), an input value of 0 becomes NOT A; join the inputs with AND; then join all the row-expressions together with OR gates (this is the sum of products method). Example: X = (NOT A AND B) OR (A AND B). A second, shorter method looks for constant values in the rows where the output is 1 (inputs that are the same across rows can be grouped, e.g. NOT A AND NOT B AND C / A AND C / A AND B).（先看是否为单一门；否则至少两个门组合（只需 NOT、AND、OR）。方法一"积之和"：只看输出为 1 的行，每行用 AND 门——输入为 1 保留字母、为 0 写成 NOT 字母，各行表达式再用 OR 连接；方法二"找常量"：输出为 1 的行中找出恒定不变的输入组合可合并，表达式更短。两种方法产生不同但等价的表达式）
- **要点 Key points**: 输出为 1 的行才需要处理；积之和法：1→字母、0→NOT 字母，AND 连同行内、OR 连行间（中文要点）

### 从逻辑表达式画电路与填真值表（From expression to circuit and truth table）
- **内容 Content**: Look at the logic expression to identify the input values, output value and the logic gates used. The brackets show the structure: the two main bracketed parts joined by the final gate (e.g. Z = (R AND S) OR (R AND T) → the OR gate is the final gate in the circuit; each bracketed section is an input into it). For nested brackets (e.g. X = ((A AND B) OR NOT C) XOR (B NOR C)), draw the final gate first (XOR), then break down each bracketed section from the inside out. Then complete the truth table from the circuit.（先识别表达式中的输入、输出与所用门；括号结构决定电路层级——最外层两个括号部分由最后一级门连接（如 Z = (R AND S) OR (R AND T)，OR 是最后一级）；嵌套括号从内向外逐层展开（如 X = ((A AND B) OR NOT C) XOR (B NOR C)，先画 XOR 再逐层分解）；最后据电路填真值表）
- **要点 Key points**: 最外层连接的门就是电路最后一级；嵌套括号从内向外画（中文要点）

### 从问题陈述写表达式/电路/真值表（Problem statement → expression, circuit and truth table）
- **内容 Content**: A problem statement describes a logic problem in natural language with criteria. Break the alarm/output conditions down line by line: for each condition, work out the binary value of each input from the given table (e.g. 'pressure ≥ 75% and temperature ≥ 50 °C' → P = 1 and T = 0), then write the expression part (AND gate with both inputs needing to be 1 – reverse any input that is 0 with a NOT gate: P AND NOT T). Join the parts with OR (the two sets of conditions are separated using an OR gate). Example: X = (P AND NOT T) OR (T AND NOT A). Then create the logic circuit and truth table.（问题陈述以自然语言描述逻辑问题并给出条件表。逐行分解报警条件：根据条件表确定每个输入的二进制值（如"压力≥75% 且 温度≥50°C"→ P=1、T=0），写表达式部分（AND 门需两个输入都为 1，为 0 的输入用 NOT 反转：P AND NOT T）；两组条件用 OR 连接；最后画电路与真值表）
- **要点 Key points**: 先查条件表确定每个输入在每种情况下的二进制值；"且"用 AND、"或"用 OR；0 值输入加 NOT（中文要点）

## 活动与编程任务（ACTIVITY，英文原文为主、中文辅助）

### ACTIVITY 10.1 What operation does an AND gate perform?（AND 门对应哪种数学运算？）
- **内容 Content**: Look at the truth table that you have completed for an AND gate (A, B → X). From the results of the logic operations, do you think that an AND gate performs an addition, subtraction, multiplication or division mathematical operation? Why? Peer assessment: discuss your thoughts with a partner and see if you agree; if not, discuss each of your reasons and work out who is correct. Did you both arrive at this answer in the same way?（观察 AND 门真值表，判断它对应加/减/乘/除哪种数学运算并说明理由；与同伴讨论是否一致、推理方式是否相同）

### ACTIVITY 10.2 What operation does an OR gate perform?（OR 门对应哪种数学运算？）
- **内容 Content**: Look at the truth table that you have completed for an OR gate (A, B → X). From the results of the logic operations, do you think that an OR gate performs an addition, subtraction, multiplication or division mathematical operation? Why? Peer assessment: discuss your thoughts with a partner and see if you agree; if not, discuss each of your reasons and work out who is correct.（观察 OR 门真值表，判断它对应哪种数学运算并说明理由；与同伴讨论）

## 章末 Summary（原文要点，中文辅助）

- A logic gate is a component in a computer that controls the flow of electricity.（逻辑门是计算机中控制电流流动的组件）
- A single value is output from a logic gate, this can be a 1 or 0. 1 sets it to high, 0 sets it to low.（逻辑门输出单一值 1 或 0：1 为高电压、0 为低电压）
- A problem statement is a description of the conditions of an electrical system.（问题陈述是电气系统条件的文字描述）
- A logic circuit is a diagrammatic representation of an electrical system showing the logic gates it uses.（逻辑电路是电气系统的图示表示，显示所用的逻辑门）
- The logic gates it can use are NOT, AND, OR, NAND, NOR and XOR.（可用的逻辑门：NOT、AND、OR、NAND、NOR、XOR）
- A truth table is a representation of all the different outputs of an electrical system, dependent on the values of each input.（真值表表示电气系统随各输入值变化的所有不同输出）
- A logic expression is a mathematical representation of an electrical system.（逻辑表达式是电气系统的数学表示）
- 六种门速记：NOT 反转输入（1 入 0 出）；AND 只有双 1 才出 1；OR 有 1 即出 1；NAND = AND + NOT（双 1 出 0）；NOR = OR + NOT（双 0 出 1）；XOR 只有一 1 才出 1（双 1 出 0）（中文辅助总结）

## 自查清单（SELF-EVALUATION，原文）

- Draw logic gates using the standard symbols（10.1-10.7）
- Describe the logic of each different logic gate（10.1-10.7）
- Complete a truth table for each logic gate（10.1-10.7）
- Identify the single logic gate that represents a given truth table（10.1-10.7）
- Complete a truth table to represent a logic circuit（10.1-10.7）
- Write a logic expression to represent a logic circuit（10.8）
- Write a logic expression to represent a truth table（10.9）
- Draw a logic circuit to represent a truth table（10.9）
- Draw a logic circuit to represent a logic expression（10.10）
- Complete a truth table to represent a logic expression（10.10）
- Write a logic expression to represent a problem statement（10.11）
- Draw a logic circuit to represent a problem statement（10.11）
- Complete a truth table to represent a problem statement（10.11）
