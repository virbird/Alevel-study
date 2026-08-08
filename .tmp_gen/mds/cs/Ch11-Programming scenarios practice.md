# Ch11 · Programming scenarios practice（编程场景练习）

> 来源：Computer Science for Cambridge IGCSE & O Level Coursebook（Sarah Lawrey & Victoria Ellis，2nd ed）Chapter 11 正文
> 内容依据教材原文整理；定义取自教材 KEY WORDS 框，以课本为准；中文对照为辅助翻译。
> 配套 PDF：分章节/Ch11-Programming scenarios practice.pdf

## 学习目标（Learning intentions 原文，中文辅助）

- analyse problems to create programming solutions（分析问题以创建编程解决方案）
- understand how to tackle a large problem（理解如何应对大问题）
- identify the inputs, processes and outputs of a problem（识别问题的输入、处理与输出）
- use pseudocode or program code to write solutions for problems（用伪代码或程序代码编写问题解决方案）

## 关键词与原文定义（KEY WORDS）

> 本章正文无 KEY WORDS 框（教材未标注新术语）；本节要点已在 Ch08（编程）与 Ch11 正文中覆盖。

## 技能重点（SKILLS FOCUS，需掌握的重要能力）

### SKILLS FOCUS 11.1 Tackling a problem（解题方法论：5 字母猜词游戏）
- **内容 Content**: Given a problem to write a computer program for, you need to know how to approach it to create a solution. Walked-through example: a game asks the user to enter a 5-letter word stored letter-by-letter in an array (e.g. 'house' → index 0-4); a second user has 10 guesses, entering one letter at a time; the program outputs the position of that letter (e.g. 'h' is in 0) or 'not in array'; after each letter guess the user gets a free word guess – correct word = win and program ends; 10 wrong letters = lose. Methodology: ① identify key features (inputs/processes/outputs table) → ② write the inputs (store all in variables) → ③ validate inputs (e.g. REPEAT ... UNTIL LENGTH(WordToGuess) = 5; UNTIL UserLetter.IsCharacter() = TRUE) → ④ take the processes one at a time (store letters in array using SUBSTRING; check letter position with a FOR loop through the array; check word guess with IF; count guesses and loop with WHILE(Count < 10) REPEAT ... ENDWHILE, incrementing Count) → ⑤ perform the final checks.（完整解题流程：先读题两遍→列输入/处理/输出表→写输入（都要存进变量）→逐个输入做校验（REPEAT/UNTIL 配合 LENGTH()、IsCharacter()）→逐个处理过程（SUBSTRING 拆字入数组、FOR 循环查字母位置、IF 判单词、WHILE 计数循环限 10 次）→最后逐项自查）
- **要点 Key points**: 计数循环模式 `Count = 0` + `WHILE(Count < 10) REPEAT ... Count ← Count + 1 ENDWHILE`；依赖关系强的过程合并处理（中文要点）

### SKILLS FOCUS 11.2 Tackling a problem with a 2D array（二维数组解题：商品销售统计）
- **内容 Content**: A 2D array stores the cost and quantity sold of 100 items (e.g. Cost row: 10.00, 15.99, ...; Quantity row: 5, 6, 8, ...). The program asks the user to select one of four actions: total number of items sold / total cost of all items sold / number of items that sold less than 10 / number of items that sold 10 or more; then calculates and outputs the answer with an appropriate message. Method: walk through the problem with a run-through table (requirement / run-through 1 / run-through 2 / steps followed), then turn each step into pseudocode: OUTPUT menu → INPUT Choice → IF Choice = 1 THEN Total ← 0; FOR Count ← 0 TO 100; Total ← Total + Array[Count, 1] ... (sum quantity); Choice = 2: Total ← Total + (Array[Count, 0] * Array[Count, 1]) (cost × quantity); Choice = 3: count items with Array[Count, 1] < 10; Choice = 4: count items with Array[Count, 1] >= 10. Finally combine: four mutually exclusive selections → use ELSEIF (more efficient than separate IFs); add validation loop on Choice (UNTIL Choice = 1 or 2 or 3 or 4); add comments.（先用手算走查表理解需求（两轮不同输入跑一遍），再逐步转伪代码；遍历数组必须用循环（计数控制 for 循环最合适）；四个互斥分支用 ELSEIF 合并比并列 IF 更高效；对菜单选择做 REPEAT/UNTIL 校验）
- **要点 Key points**: 2D 数组下标 `Array[Count, 0]`（成本）、`Array[Count, 1]`（数量）；`Total ← Total + ...` 累加模式；`Numberitems ← Numberitems + 1` 计数模式（中文要点）

## 活动与编程任务（ACTIVITY / PROGRAMMING TASK，英文原文为主、中文辅助）

### ACTIVITY 11.1 Inputs, processes and outputs of your favourite game（你最喜欢游戏的输入/处理/输出）
- **内容 Content**: Write down some of the inputs, processes and outputs for your favourite computer game. Peer assessment: compare your game with a partner's – can you think of any more inputs, processes or outputs for their game?（写下你最喜欢游戏的部分输入/处理/输出，并与同伴互评补充）

### ACTIVITY 11.2 Identify IPO for an existing program（为已有程序做 IPO 分析）
- **内容 Content**: Open a program you have already written. Identify the inputs, processes and outputs for this program. Reflection: how did you investigate? Did you work through each line of code at a time, or just focus on the elements you were looking for?（打开自己写过的程序，识别其输入/处理/输出；反思分析方式）

### ACTIVITY 11.3 Final checks on the calculator solution（对计算器解答执行最终自查）
- **内容 Content**: Read the calculator pseudocode solution in the chapter and complete the final checks on the algorithm. Tick each one in turn to make sure it has been covered in the solution.（对照 8 条最终检查清单逐项核对计算器伪代码是否覆盖）

### PROGRAMMING TASK 11.1 Game character movement（游戏角色移动）
- **内容 Content**: A character in a computer game has an x coordinate and a y coordinate (e.g. x = 10, y = 20). The user enters a command to move right / left / up / down: left decreases x by 1, right increases x by 1, up increases y by 1, down decreases y by 1. The new position is output. Getting started: identify the inputs, processes and outputs. Practice: write a program in pseudocode or program code. Challenge: the x coordinate can only be between 0 and 200, y between 0 and 150 – add validation to make sure the character's positions do not go outside these boundaries.（角色坐标移动程序；先列 IPO；挑战：边界校验 0-200 / 0-150）

### PROGRAMMING TASK 11.2 Guessing game（猜数字游戏）
- **内容 Content**: A guessing game stores a number in a constant. The user has 10 attempts. Too high → outputs "Too high"; too low → "Too low"; correct → outputs the number of guesses and game ends; 10 incorrect guesses → outputs the number and the user has lost. Getting started: identify the data that needs to be input, the outputs, and any variables or constants needed. Practice: write the program; check all requirements are met; add comments. Challenge (beyond the specification): use a random number generator to declare the number at the start of the game instead of hard coding it.（猜数字：常量存答案、10 次机会、高低提示；挑战：改用随机数生成答案）

### PROGRAMMING TASK 11.3 Hexadecimal to binary and denary converter（十六进制转换器）
- **内容 Content**: A program takes a 2-digit hexadecimal number as input (e.g. 3C) and outputs the binary and denary equivalent. Getting started: how do you convert a 2-digit hexadecimal number to binary? to denary? What inputs and outputs are needed? Practice: write the program. Challenge: ask the user what type of data they are entering and what type they want output (e.g. enter denary 1 → output 8-bit binary 00000001).（输入两位十六进制数（如 3C），输出二进制与十进制；挑战：任意进制互转）

### PROGRAMMING TASK 11.4 Cost per kilogram tally（按公斤计费统计）
- **内容 Content**: A program asks the user to enter the cost per kilogram for a product (e.g. $1.20). The user then enters the weight of each item while the total cost is less than $100.00. The program outputs how many items were entered and the total cost. Getting started: identify the inputs, outputs and processes. Challenge: store the weight and cost of each item entered in an array; when the last item is entered, store the weights and costs in a text file.（输入每公斤单价，循环输入每件重量直到总价 ≥ $100，输出件数与总价；挑战：数组存明细并写入文本文件）

### PROGRAMMING TASK 11.5 Username and password registration（用户名密码注册）
- **内容 Content**: A program allows a user to select a username and password. The array Logins has up to 1000 indices; NumberUsers stores how many usernames are currently stored. A valid username: does not already exist in Logins; has at least 8 characters; contains at least one letter and at least one number. Getting started: identify inputs, outputs and the requirements for the username and password. Practice: write the program to enter a username and password and store it in Logins. Challenge (beyond the specification): store usernames and passwords in a text file (one per line); at start read all into an array, at end write all back.（注册校验：用户名唯一性 + 至少 8 字符 + 至少一个字母和一个数字；挑战：改用文本文件持久化）

### PROGRAMMING TASK 11.6 Rock, paper, scissors（石头剪刀布）
- **内容 Content**: Two people select rock, paper or scissors. Rules: rock wins over scissors; scissors wins over paper; paper wins over rock. Getting started: play the game with another student; identify the inputs, processes and outputs. Practice: write a program for two players; amend it to use a function that takes the two moves as parameters and returns which player won. Challenge: play 11 games and output who has won the most; let the player choose to play another player or the computer (random numbers); use a file to record a high score and the player who achieved it, updated after each game.（双人石头剪刀布；函数化判胜负（两个参数返回胜者）；挑战：11 局制、对战电脑（随机数）、最高分文件）

## 章末 Summary（原文要点，中文辅助）

- Always read the scenario twice before starting.（动笔前一定把题读两遍）
- Walk through the requirements, acting out each statement to identify how the system needs to work.（逐句走查需求，把每个要求"演"一遍来弄清系统如何工作）
- Identify the inputs, processes and outputs of a system.（先识别系统的输入、处理与输出）
- Include validation to any inputs.（对所有输入做校验）
- Use appropriate messages when inputting and outputting data.（输入/输出数据时使用合适的提示信息）
- Add comments to explain your code.（加注释解释代码）

## 自查清单（SELF-EVALUATION，原文）

- identify the inputs for a system（11.2）
- identify the processes for a system（11.2）
- identify the outputs for a system（11.2）
- validate input data（11.3）
- use appropriate input and output messages（11.3）
- add comments to explain my code（11.3）
