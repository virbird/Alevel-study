# Ch07 · Algorithm design and problem solving（算法设计与问题求解）

> 来源：Computer Science for Cambridge IGCSE & O Level Coursebook（Sarah Lawrey & Victoria Ellis，2nd ed）Chapter 7 正文
> 内容依据教材原文整理；定义取自教材 KEY WORDS 框，以课本为准；中文对照为辅助翻译。
> 配套 PDF：分章节/Ch07-Algorithm design and problem solving.pdf

## 学习目标（Learning intentions 原文，中文辅助）

- learn about the use of, and stages in, the program development life cycle（学习程序开发生命周期的使用与阶段）
- use decomposition to split a system into sub-systems（用分解把系统拆分为子系统）
- create structure diagrams, flowcharts and pseudocode algorithms（创建结构图、流程图与伪代码算法）
- explain how a bubble sort and linear search works（解释冒泡排序与线性搜索的工作原理）
- describe and produce algorithms that include finding the maximum, minimum and average values（描述并编写求最大值、最小值与平均值的算法）
- understand the need for validation and verification and write programs that use both（理解验证与核实的作用并编写使用两者的程序）
- identify appropriate test data for an algorithm（为算法识别合适的测试数据）
- complete a trace table for an algorithm（完成算法的追踪表）
- learn how to check a program for errors and amend the program（学习如何检查程序错误并修改程序）
- learn how to explain the purpose of an algorithm（学习如何解释算法的用途）

## 关键词与原文定义（KEY WORDS）

| 关键词 (EN) | 原文定义（教材 KEY WORDS 框） | 中文对照 |
|-------------|--------------------------|----------|
| program development life cycle | A series of structure step/activities that are followed to produce a system. | 程序开发生命周期 |
| analysis | The first stage of the program development life cycle that involves investigating the problem. | 分析 |
| decomposition | Taking a system and splitting it into smaller sub-systems, which can in turn be split into smaller sub-systems. | 分解 |
| design | The second stage of the program development life cycle, which involves decomposition of the problem and algorithms created ready for implementation. | 设计 |
| structure diagram | A hierarchical diagram that shows the decomposition of a system. | 结构图 |
| process | An action that is performed, for example, X ← X + 1. | 处理（过程） |
| decompose | The action of performing decomposition; splitting a system into smaller sub-systems, which can in turn be split into smaller sub-systems. | 分解（动词） |
| flowchart | A diagrammatic representation of an algorithm. | 流程图 |
| pseudocode | Code-like statements that are used to design an algorithm but do not follow any specific language. | 伪代码 |
| coding | The writing of a program using one or more programming languages. | 编码 |
| testing | Repeated use of a system to try all different possibilities to make sure the system is fully working and cannot be broken. | 测试 |
| test data | The input data that is used to test a system. | 测试数据 |
| normal test data | Data that a program should accept. | 正常测试数据 |
| abnormal test data | Data that a program should not accept. | 异常测试数据 |
| extreme test data | Data that is on the edge of what is allowed. | 极端测试数据 |
| boundary test data | Data that is on the edge of being accepted, and data that is on the edge of not being accepted. | 边界测试数据 |
| search algorithm | A series of steps that searches for a specific value in a set of data. | 搜索算法 |
| sorting algorithm | A series of steps that will rearrange a set of data into an order, e.g. ascending numerical data. | 排序算法 |
| linear search | A search algorithm that visits each item of data in turn to check whether it is the data being looked for. | 线性搜索 |
| bubble sort | A sorting algorithm that moves through the list repeatedly swapping values in pairs. | 冒泡排序 |
| totalling | Statements in a program that add together a set of data to produce the total. | 合计 |
| counting | Statements in a program that record how many of something there are. | 计数 |
| minimum | The smallest item in a set of data. | 最小值 |
| maximum | The largest item in a set of data. | 最大值 |
| average | The mean of a set of values, the total divided by the quantity. | 平均值 |
| validation | The checking of data to make sure it is reasonable and within set bounds. | 验证（数据合理性） |
| range check | A type of validation that makes sure data is between the minimum and maximum. | 范围检查 |
| length check | A type of validation that checks the number of characters is within a set limit. | 长度检查 |
| type check | A type of validation that checks data is the correct data type. | 类型检查 |
| presence check | A type of validation that makes sure data has been entered. | 存在性检查 |
| format check | A type of validation that makes sure the data meets a specific order, e.g. 1 number, then 3 letters. | 格式检查 |
| check digit | A type of error detection method that is used for data entry. A calculation is performed on the data entered to create a value. Check digit values are compared to see if the data entered is correct. | 校验位 |
| verification | Checking that data is entered accurately, that it is the same as the original. | 核实（录入准确性） |
| visual check | Comparing the data entered with the original side-by-side. | 视觉核对 |
| double entry check | Two different people enter the same data which are then compared. | 双重录入核对 |
| trace table | A structure to complete when walking through an algorithm manually, where the values that change are written in each row. | 追踪表 |

## 技能重点（SKILLS FOCUS，需掌握的重要能力）

### SKILLS FOCUS 7.1/7.2 Bubble sort（冒泡排序实操）
- **内容 Content**: When performing a bubble sort, first identify the order required (ascending or descending) and the data item being sorted (number, letter, words). Sort the numbers 6 2 5 1 into ascending order: keep sorting until either (a) you have passed through all numbers 3 times (number of items − 1), or (b) you have passed through all the numbers once without making any changes. Pass 1: compare pairs in turn and swap if in the wrong order (6 2 5 1 → 2 6 5 1 → 2 5 6 1 → 2 5 1 6); made changes so repeat. Pass 2: 2 5 1 6 → 2 1 5 6 (one swap). Pass 3: 2 1 5 6 → 1 2 5 6 (one swap) and 3 passes = items − 1, so stop. For descending order with characters (z c f a h), the same process applies but swapping when the pair is in the wrong (ascending) order; stop after 4 passes or a pass with no changes.（冒泡排序先确定顺序（升/降）与数据类型；数字升序 6 2 5 1：逐对比较、顺序不对就交换，直到满足"已遍历 N−1 次"或"某次遍历无任何交换"两个停止条件之一；每轮把最大（或最小）值"冒泡"到末尾；字符/字符串同理）
- **要点 Key points**: 停止条件二选一：遍历次数达到元素数−1，或某轮全程无交换；每轮比较相邻两元素（中文要点）

### SKILLS FOCUS 7.3/7.4 Trace tables（追踪表：选择与循环）
- **内容 Content**: To create a trace table: identify all the variables in an algorithm – each variable has its own column, plus an output column if the program outputs data. Complete the table by reading through the algorithm one line at a time (do not jump ahead): write each new value of a variable below the previous one. For loops (e.g. WHILE): when you reach the end of the loop, go back to the start and re-check the condition; when a variable gets a new value it is written below the previous one. Outputs must match the code exactly (e.g. 'The total is 10', not 'total = 10').（追踪表：每个变量一列、输出一列；逐行执行算法并把变量新值写在旧值下方；遇到循环回到循环头重判条件；输出必须与代码完全一致）
- **要点 Key points**: 不要跳行猜测；WHILE 循环每轮都要回到条件判断；初始赋值（如 Count←0, InputValue←1, Total←0）也要记录（中文要点）

### SKILLS FOCUS 7.5/7.6 Finding the purpose of an algorithm（确定算法用途）
- **内容 Content**: A trace table can help you work out the purpose of an algorithm: test the algorithm with data you come up with, complete a trace table, then repeat with different data until you can identify the pattern. When describing an algorithm, do more than repeat the line of code using English statements – describe what the whole algorithm does (e.g. 'The algorithm takes a number from the user, and then outputs all of the numbers from 0 to the number input').（用自拟数据运行算法、完成追踪表、换不同数据重复直到看出模式；描述算法时不要逐行翻译代码，而要说明整个算法做什么）
- **要点 Key points**: 至少用两组不同数据测试；描述要概括整体功能而非罗列语句（中文要点）

### SKILLS FOCUS 7.7/7.8 Finding errors（用追踪表/读代码找错）
- **内容 Content**: To find an error you need to know the purpose of the algorithm, test it with different data (completing trace tables if needed), and compare what it does with what it should do. Example: a program should take 5 numbers and output the total, but the trace table shows: (1) the total is overwritten each time (line 05 should be Total ← Total + Number); (2) total starts at 1 instead of 0; (3) only 4 numbers can be input (either line 02 Quantity ← 0 or line 03 WHILE Quantity < 6). Alternative method – read the code against each requirement: for 'output the largest value', check (a) largest is initialised with a low number (not 999), (b) it checks if data is larger than largest (not < 999), (c) the correct identifier is used (Largest, not Large).（找错步骤：先明确算法目的→用不同数据测试（必要时用追踪表）→对比实际与应有行为；常见错误类型：变量被覆盖而非累加、初始值错误、循环次数错误、比较方向/条件错误、标识符拼写错误；也可按需求逐条检查代码）
- **要点 Key points**: 追踪表能暴露"变量被覆盖"与"初始值错误"；按需求逐条核对可发现比较方向与标识符错误（中文要点）

## 活动与编程任务（ACTIVITY / PROGRAMMING TASK，英文原文为主、中文辅助）

### ACTIVITY 7.1 Splitting subprograms further（继续拆分子程序）
- **内容 Content**: Can you split any of these subprograms down further? In 'Check won' (chess program) what should happen if the result is checkmate? Should there be an output? What if there is check but not checkmate? Should this be output? Peer assessment: compare your subsystems with a friend – are they both valid structure diagrams even though they are different?（把国际象棋程序的子程序继续拆分：将死时应输出什么？将军但未将死时呢？与同学比较结构图是否都有效）

### ACTIVITY 7.2 Flowchart for making a drink（泡茶流程图）
- **内容 Content**: Flowcharts can be used for more than writing programs. Work in pairs to produce a flowchart for making a cup of tea, or coffee, or another drink.（两人一组为泡茶/咖啡等日常活动画流程图）

### ACTIVITY 7.4 Testing a computer game（游戏测试讨论）
- **内容 Content**: In pairs find a computer game to play. Anything as simple as a puzzle game, to a full 3D adventure game. Discuss how this game might have been tested. What data would be used as inputs?（找一款游戏（从简单谜题到 3D 冒险）讨论它可能如何被测试、用什么数据作为输入）

### ACTIVITY 7.5 Linear search with cards（扑克牌线性搜索）
- **内容 Content**: Get a set of playing cards. Select 10 random cards and place them face down on the table in a row. Perform a linear search to see if the Ace of Spades is in the set: turn over the first card; is it the Ace of Spades? If it is, stop searching; if it isn't, turn over the next card and repeat.（10 张随机扑克牌排成一排，逐张翻开执行线性搜索找黑桃 A：找到即停，否则翻下一张重复）

### ACTIVITY 7.6 Bubble sort with cards（扑克牌冒泡排序）
- **内容 Content**: Get a set of playing cards. Select 10 random cards and place them face down on the table in a row. Perform a bubble sort to put the cards in ascending numerical order: turn over the first two cards; if the 1st is larger than the 2nd, swap them; repeat for each adjacent pair; after going through all 10 cards once, check if you made any swaps – if so, start again; if not, stop because the cards should be in order.（10 张扑克牌执行冒泡排序：相邻两张比较、顺序错则交换；一轮过后若有交换则再来一轮，直到某轮无交换停止）

### ACTIVITY 7.7 Validation on input（输入验证探索）
- **内容 Content**: Have you ever entered data to be told that it is invalid? What were you trying to enter, and why was it incorrect? Visit some websites that need you to enter some data (but stay safe and make sure it is not personal data). What restrictions do they have? Are there some spaces that you need to enter data in? Do some of them give you a set structure to fill in, for example, a date as __ / __ / ____? Are these all controlled with validation rules?（回忆被提示"输入无效"的经历；访问需要输入数据的网站（注意安全勿输个人数据），观察其限制：必填项、固定格式（如日期 __/__/____）等是否都由验证规则控制）

### ACTIVITY 7.8 Validation and verification survey（验证与核实调查）
- **内容 Content**: Work in pairs to identify how many times you have come across validation or verification in a program or website. Compare your answers with another pair. How common are validation and verification? Are there any methods not identified here, for example, what is two-step verification?（两人一组统计在程序/网站中遇到过多少次验证或核实，与其他组比较并讨论未提及的方法）

### ACTIVITY 7.9 Trace table practice（追踪表练习）
- **内容 Content**: Run the algorithm in Skills Focus 7.3 (INPUT Number1, INPUT Number2, IF Number1 > Number2 THEN OUTPUT(Number1) ELSE OUTPUT(Number2)) with the following input data: a) 10, 2; b) 9, 9; c) 20, 30. Peer assessment: compare your answers with a partner; if not the same, run the algorithms again to find which is correct.（用三组数据（10,2 / 9,9 / 20,30）练习追踪表，与同伴核对结果）

### ACTIVITY 7.10 Trace table with loops（循环追踪表练习）
- **内容 Content**: Trace the algorithm in Skills Focus 7.4 (Count/InputValue/Total with WHILE InputValue > 0) with the following inputs: a) 1, 6, 8, 2, 0; b) 1, −1, 2; c) 10, 20, 30, −5. Self assessment: trace each a second time and see whether you got the same result.（用三组输入数据练习含循环的追踪表，重复追踪自查）

### PROGRAMMING TASK 7.1 Guess the number（猜数字游戏）
- **内容 Content**: A computer game stores a number for the user to guess. The user has up to 10 attempts. After each turn the program outputs whether the guessed number is smaller, larger, or equal to the target. If they use 10 guesses without getting it correct, tell them the answer; if correct, output the number of attempts. Getting started: play the game with a partner and identify the inputs, processes and outputs; recap structure diagrams and decomposition. Practice: decompose the system with a structure diagram; draw a flowchart; convert it into pseudocode. Challenge: make the code efficient (remove unused variables, reduce lines); amend the program so a random number is generated each time it runs.（猜数字游戏：10 次机会内猜中，每次提示大小；正确则输出所用次数，10 次未中则公布答案；先玩真人版分析 IPO，再画结构图、流程图、转伪代码；挑战：优化代码效率、改为随机生成目标数）

### PROGRAMMING TASK 7.2 Linear search and bubble sort（线性搜索与冒泡排序程序）
- **内容 Content**: A program asks the user to enter a set of 20 numbers. The user can then enter a number for the program to search for; the program outputs if it is found or not, then puts the data into ascending order and outputs the newly arranged data. Getting started: practise linear search and bubble sort with cards; recap input/output/selection/iteration; read the algorithms with a partner. Practice: identify inputs/processes/outputs; create a structure diagram; write pseudocode to take in the 20 numbers; amend to perform a linear search; amend to perform a bubble sort. Challenge: move the linear search and bubble sort into their own subroutines so they can be called from anywhere in the main program.（输入 20 个数、搜索指定值并输出是否找到、升序排序后输出；先用扑克牌练习两种算法，再写伪代码逐步完善；挑战：把搜索与排序封装为子程序）

### PROGRAMMING TASK 7.3 Totalling（商品总价程序）
- **内容 Content**: A program is needed to ask the user to input the price of products they have bought, calculate and output the total cost. Getting started: identify the steps to find the total (initialising the total to 0 will be the first step); work out how to continue asking until they have no more products. Practice: create a structure diagram; write an algorithm to repeatedly input prices until there are no more; amend it to total the cost and output at the end. Challenge: amend to also count how many items were entered; use the total and quantity to work out the average cost.（输入商品价格直到用户结束，计算并输出总价；挑战：增加计数与平均价计算）

### PROGRAMMING TASK 7.4 Counting（包裹重量分类计数）
- **内容 Content**: A program needs to ask the user to input the weight of parcels being posted. It needs to count how many parcels are less than 1 kg, how many are between 1 kg and 2 kg, and how many are above 2 kg. Getting started: recap how to count in an algorithm (initialise the count to 0); recap selection and the operators >, >=, < and <=. Practice: draw a structure diagram; write an algorithm to read weights until the user has finished; amend to count and output each category. Challenge: let the user enter the limits themselves when the program starts (e.g. count how many parcels are less than 1.5 kg instead of 1 kg).（输入包裹重量，统计 <1kg、1-2kg、>2kg 三类的数量；挑战：让用户自定义分类界限）

### PROGRAMMING TASK 7.5 Minimum, maximum and average（成绩统计程序）
- **内容 Content**: A teacher needs a system to calculate the lowest, highest and average mark their 30 students got in a test out of 100. Getting started: identify the code required for minimum and maximum values; recap how to calculate an average; recap how to loop 30 times. Practice: write an algorithm to enter all 30 marks; amend to calculate and output the minimum, maximum and average. Challenge: extend to count how many got below/above the average; work out how many got each level (80+ = distinction, 60+ = merit, 40+ = pass, below 40 = fail).（输入 30 名学生成绩，输出最低分、最高分与平均分；挑战：统计低于/高于平均分人数、按等级（80+ 优/60+ 良/40+ 及格/<40 不及格）分类）

### PROGRAMMING TASK 7.6 Validation（数据验证程序）
- **内容 Content**: A user needs to enter a series of data that each require validation: Username (minimum length of 5 characters); Date of birth (in the format NN/NN/NNNN, e.g. 01/01/2020); Type of character (limited to: "Elf", "Fairy", "Gnome", "Magician"); Starting strength (a number between 1 and 5 inclusive); Starting health (10 minus the starting strength input). Getting started: for each requirement decide on which type of validation to use – try and choose a different one for each value. Practice: write an algorithm to take the five values; amend to include the validation for each; output whether each is valid or invalid. Challenge: repeatedly ask for each item until a valid one is entered; find at least one piece of data that can have two types of validation and implement it.（为用户名/出生日期/角色类型/初始力量/初始生命五项数据各选一种验证方式（尽量不重复），实现验证并输出有效/无效；挑战：循环直到输入有效、为某项数据实现双重验证）

## 章末 Summary（原文要点，中文辅助）

- Programs are developed by following a program development life cycle.（程序按程序开发生命周期开发）
- The program development life cycle is made up of: analysis, design, coding and testing.（生命周期由分析、设计、编码与测试组成）
- In the analysis stage the problem is identified and decomposed. In the design stage the algorithms are planned. In the coding stage the program is written. In the testing stage the program is tested.（分析阶段识别并分解问题；设计阶段规划算法；编码阶段编写程序；测试阶段测试程序）
- Decomposition is the splitting of a system into sub-systems. Decomposition can be shown using a structure diagram.（分解是把系统拆分为子系统；可用结构图表示）
- Algorithms can be planned using flowcharts and pseudocode.（算法可用流程图与伪代码规划）
- A linear search checks each item of data in turn.（线性搜索逐个检查数据项）
- A bubble sort compares the items in pairs repeatedly.（冒泡排序反复成对比较元素）
- Totalling is adding together the values. Counting is adding 1 to the count for each item.（合计是把数值相加；计数是每项加 1）
- To find the minimum value, a variable needs to be initialised with a large value. To find the maximum value, a variable needs to be initialised with a small value.（求最小值变量初始化为大值；求最大值变量初始化为小值）
- Validation is checking data entered is reasonable and within bounds. Validation checks include: range check, length check, type check, presence check, format check and check digit.（验证是检查输入数据是否合理且在界限内；验证检查包括范围、长度、类型、存在性、格式检查与校验位）
- Verification checks that data has been input accurately. Verification checks include visual check and double entry check.（核实检查数据录入是否准确；核实方法包括视觉核对与双重录入核对）
- Four types of test data are normal, abnormal, extreme and boundary.（四类测试数据：正常、异常、极端与边界）
- A trace table is used to dry run an algorithm. It can be used to find the purpose of an algorithm and to find errors in the algorithm.（追踪表用于手动运行算法，可用来确定算法用途与查找错误）

## 自查清单（SELF-EVALUATION，原文）

- Identify the stages in the program development life cycle（7.1）
- Use decomposition to split a system into sub-systems（7.2）
- Create structure diagrams, flowcharts and pseudocode algorithms（7.3）
- Explain how a bubble sort and linear search works（7.7）
- Describe and produce algorithms that include finding the maximum, minimum and average values（7.7）
- Understand the need for validation and verification and write programs that make use of each（7.7）
- Identify appropriate test data for an algorithm（7.6）
- Complete a trace table for an algorithm（7.8）
- Check a program for errors and amend the program（7.10）
- Explain the purpose of an algorithm（7.9）
