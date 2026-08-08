# Ch08 · Programming（程序设计）

> 来源：Computer Science for Cambridge IGCSE & O Level Coursebook（Sarah Lawrey & Victoria Ellis，2nd ed）Chapter 8 正文
> 内容依据教材原文整理；定义取自教材 KEY WORDS 框，以课本为准；中文对照为辅助翻译。
> 配套 PDF：分章节/Ch08-Programming.pdf

## 学习目标（Learning intentions 原文，中文辅助）

- learn how to write programs using pseudocode（学习用伪代码编写程序）
- use variables and constants（使用变量与常量）
- learn about the appropriate use of basic data types（学习基本数据类型的使用）
- write programs that use input and output（编写使用输入与输出的程序）
- write programs that use sequence（编写使用顺序结构的程序）
- write programs that use arithmetic operators（编写使用算术运算符的程序）
- write programs that use selection including IF and CASE statements（编写使用 IF 与 CASE 选择的程序）
- write programs that include logical and Boolean operators（编写包含逻辑与布尔运算符的程序）
- write programs that use iteration including count-controlled, pre-condition and post-condition loops（编写使用计数控制、前置条件与后置条件循环的程序）
- write programs that use totalling and counting（编写使用合计与计数的程序）
- write programs that perform the string handling methods length and substring（编写执行字符串处理 length 与 substring 方法的程序）
- write programs that use nested statements（编写使用嵌套语句的程序）
- understand the purpose of subroutines（理解子程序的作用）
- understand the differences between procedures and functions（理解过程与函数的区别）
- write programs that use subroutines（编写使用子程序的程序）
- understand the purpose and use of parameters（理解参数的作用与使用）
- write programs with subroutines that take parameters（编写带参数的子程序）
- write programs with the library routines MOD, DIV, ROUND and RANDOM（编写使用库例程 MOD、DIV、ROUND、RANDOM 的程序）
- understand what makes a program maintainable（理解什么使程序可维护）
- add features to programs to improve the maintainability（为程序添加功能以提高可维护性）
- understand the use of arrays as data structures（理解数组作为数据结构的用途）
- write programs using 1-dimensional arrays（编写使用一维数组的程序）
- write programs using 2-dimensional arrays（编写使用二维数组的程序）
- understand the need to store data in files（理解把数据存入文件的必要性）
- write programs to read data from a file（编写从文件读取数据的程序）
- write programs to write data to a file（编写向文件写入数据的程序）

## 关键词与原文定义（KEY WORDS）

| 关键词 (EN) | 原文定义（教材 KEY WORDS 框） | 中文对照 |
|-------------|--------------------------|----------|
| variable | A named memory location that can store data. The data can change whilst a program is running. | 变量 |
| constant | A named memory location that can store data. The data cannot change whilst a program is running. | 常量 |
| identifier | A name given to a variable, constant, data structure (e.g. array) or subroutine. | 标识符 |
| assignment | A type of programming statement that stores data in a variable or constant. | 赋值 |
| string | A data type. Any characters including letters, numbers and/or symbols. | 字符串 |
| data type | The characteristics of a piece of data. Common data types are string, integer, real and Boolean. | 数据类型 |
| integer | A data type. Whole numbers. | 整数 |
| real | A data type. Decimal numbers. | 实数 |
| single | A data type. Decimal numbers. | 单精度 |
| double | A data type. Decimal numbers. | 双精度 |
| Boolean | A data type. True or False. | 布尔 |
| char | A single character, e.g. 'A', '9'. | 字符 |
| casting | Converting data from one data type to another data type. | 类型转换 |
| output | Data that is displayed to the user usually on-screen. | 输出 |
| concatenation | Joining two or more strings together. | 拼接 |
| input | The user entering data into the program, usually from a keyboard. | 输入 |
| arithmetic operator | A symbol that performs a mathematical function, e.g. '+' adds two values together. | 算术运算符 |
| MOD | Remainder division. The remainder after the division is performed, e.g. MOD(5, 2) = 1. | 取余 |
| DIV | Integer division. The remainder from the division is ignored, e.g. DIV(5, 2) = 2. | 整除 |
| parentheses | Brackets in a mathematical statement. They determine which calculations are performed first. | 括号 |
| sequence | A programming construct. Instructions are run once and in the order they are written. | 顺序 |
| selection | A programming construct. A condition is checked and this determines which code is run, or not run. | 选择 |
| IF statement | A type of selection construct where the result of the condition is either true or false. | IF 语句 |
| CASE statement | A type of selection construct where there is a list of different values to compare a single value against. | CASE 语句 |
| logical operator | A symbol that performs a comparison resulting in True or False. Can be equals, not equal to, less than, less than or equal to, greater than, greater than or equal to. | 逻辑运算符 |
| Boolean operator | A symbol that joins multiple logical comparisons, can be AND, OR or NOT. | 布尔运算符 |
| AND operator | Returns True when both inputs are True. | 与 |
| NOT operator | Returns True if the input is False, and False if it is True. | 非 |
| OR operator | Returns True when one, or both, inputs are True. | 或 |
| iteration | A programming construct. Code is run multiple times – either a finite number of times (count-controlled), until a condition is true (post-condition), or while a condition is true (pre-condition). | 迭代 |
| loop | Another name for iteration. | 循环 |
| count-controlled loop | A type of iteration. Code is run a finite number of times. Usually a for loop. | 计数控制循环 |
| pre-condition loop | A type of iteration. Code is run while the condition is true. The condition is checked before running any code in the loop, therefore the code might never run. | 前置条件循环 |
| post-condition loop | A type of iteration. Code is run until a condition is true. The condition is checked after the code in the loop is run, therefore the code always runs once. | 后置条件循环 |
| totalling | A type of program; it adds up multiple values to find the total. | 合计 |
| counting | A type of program; it adds one for every item to find out how many there are. | 计数 |
| nested statement | A construct (selection or iteration) that is inside another construct. | 嵌套语句 |
| subroutine | A self-contained piece of code that has an identifier and can be called from elsewhere in a program. | 子程序 |
| procedure | A subroutine that does not return a value to the program that called it. | 过程 |
| function | A subroutine that does return a value to the program that called it. | 函数 |
| parameter | A value that is sent to a subroutine. | 参数 |
| scope | The sections in the code where the variable, or constant, can be accessed. | 作用域 |
| global scope | The variable or constant can be accessed from any part of the program. | 全局作用域 |
| local scope | The variable or constant can only be accessed in the subroutine it is declared within. | 局部作用域 |
| library routine | A pre-written subroutine that can be called from within a program. | 库例程 |
| maintainable program | A program that has key features to help it be understood at a later date. | 可维护程序 |
| comment | Text within a program to describe its function; it is not executed when the program is run. | 注释 |
| array | A data structure where you can store multiple data items, of the same data type, under one identifier. | 数组 |
| 1-dimensional array | An array that has only one index. | 一维数组 |
| index | The number of the space in the array. | 下标 |
| 2-dimensional array | An array that has two indices. | 二维数组 |
| file handling | Programming statements that allow text files to be opened, read from, written to and closed. | 文件处理 |

## 技能重点（SKILLS FOCUS，需掌握的重要能力）

### SKILLS FOCUS 8.1 MOD vs DIV（取余与整除的区别）
- **内容 Content**: DIV gives the whole number after the division and ignores any remainder: DIV(10, 2) = 5; DIV(20, 7) = 2 (ignore the numbers after the decimal point); DIV(100, 21) = 4. MOD gives the remainder after division – not the decimal part, but how many values are left: MOD(10, 2) = 0; MOD(20, 7) = 6 (take the DIV result 2, multiply by the divisor 7 × 2 = 14, the remainder is 20 − 14 = 6); MOD(100, 21) = 16 (21 × 4 = 84, 100 − 84 = 16). MOD 2 special use: MOD(10, 2) = 0 therefore 10 is even; MOD(11, 2) = 1 therefore 11 is odd.（DIV 取整除后的整数部分（忽略余数）；MOD 取除法后的余数（计算法：DIV 结果 × 除数，再用被除数减去该值）；MOD 2 可判断奇偶：余 0 为偶、余 1 为奇）
- **要点 Key points**: MOD(5,2)=1 而非 2（教材定义示例）；MOD 判断奇偶是常考点（中文要点）

### SKILLS FOCUS 8.2 Comparison operators（比较运算符）
- **内容 Content**: Comparison operators are used in comparison statements (both selection and iteration): = or == equals; <> or != not equal to; < less than; <= less than or equal to; > greater than; >= greater than or equal to. A common error is confusing less than and greater than – the shape helps: in IF (10 < 2) the smaller part of the < is nearest the left (the 10), so it reads "if 10 is less than 2" → False; in IF (150 > 25) the larger part of the > is nearest the left (the 150), so "if 150 is greater than 25" → True.（比较运算符用于选择与迭代：=、<>、<、<=、>、>=；区分 < 与 > 的技巧：符号的开口朝向哪边——< 的小口靠左表示"小于"，> 的大口靠左表示"大于"）
- **要点 Key points**: <= 与 >= 包含相等的情况；每个比较语句结果为 True 或 False（中文要点）

### SKILLS FOCUS 8.3 Converting a FOR loop to a WHILE loop（循环类型转换）
- **内容 Content**: The three types of loop can often be written as a different type. Converting a FOR loop to a WHILE loop: Step 1: declare the variable used as the counter with its starting value (X = 1); Step 2: take the last value and put it in the while loop condition (loop until it is 10, so the condition is WHILE X < 11); Step 3: increment the counter in the loop (X ← X + 1).（FOR 转 WHILE 三步：①声明计数器及其初值；②把终值放入 WHILE 条件（如到 10 则 WHILE X < 11）；③循环体内递增计数器）
- **要点 Key points**: 前置/后置循环可互转；只有比较对象是计数（如循环 10 次）时才能转成计数控制循环（中文要点）

### SKILLS FOCUS 8.4 String handling: UPPER and LOWER（字符串大小写转换）
- **内容 Content**: The characters a-z can be converted into uppercase and the characters A-Z can be converted into lowercase. This can be done to an individual character, or to an entire string at the same time. If a character is already in upper case, trying to convert it to upper case will not change it. UPPER(string) and LOWER(string) are the pseudocode forms: UPPER("Hello") will return "HELLO"; with a variable: Word ← "HELLO"; Word ← LOWER(Word) → "hello". Language equivalents: VB.NET .toUpper()/.toLower(), Python .upper()/.lower(), Java .toUpperCase()/.toLowerCase().（UPPER 把 a-z 转大写、LOWER 把 A-Z 转小写；可作用于单个字符或整个字符串；已是大写再转大写不变。伪代码形式 UPPER(字符串)/LOWER(字符串)：UPPER("Hello") 返回 "HELLO"；变量例：Word ← "HELLO"，Word ← LOWER(Word) 得 "hello"。各语言等价方法：VB.NET toUpper/toLower、Python upper/lower、Java toUpperCase/toLowerCase）
- **要点 Key points**: 大小写转换可整体也可单字符；常用于输入规范化（如用户名比对前统一转小写）（中文要点）

## 活动与编程任务（ACTIVITY / PROGRAMMING TASK，英文原文为主、中文辅助）

### ACTIVITY 8.1 Data types（数据类型举例）
- **内容 Content**: Take each data type in turn and think of at least 10 different examples of data that can be stored (apart from Boolean where there can be only two). From these, identify whether any of these could be more than one data type; discuss in pairs what options would be valid and which would be most appropriate. Peer assessment: compare your work with another pair.（为每种数据类型想至少 10 个可存储数据的例子（Boolean 除外），讨论哪些数据可以属于多种类型、哪种选择最合适；互评）

### ACTIVITY 8.2 IF vs CASE（IF 与 CASE 的区别）
- **内容 Content**: What is the difference between IF and CASE statements? Is there a scenario when one is more appropriate than another? Write one example of each where that is the most appropriate type to use. Peer assessment: explain your choices to a partner – are the different points of view all valid?（讨论 IF 与 CASE 的区别与各自更适用的场景，各写一个例子；互评观点是否都成立）

### ACTIVITY 8.3 AND, OR, NOT in real life（布尔运算符的实际应用）
- **内容 Content**: Make a list of the use of AND, OR and NOT in real-life situations. For example, if one of two light switches is pressed then a light turns on (OR); if the door is locked and you have the key then you can unlock the door (AND). Share your list in groups of 3, discuss whether each statement has been correctly identified as AND, OR or NOT, and select one of each to share with the class.（列举 AND、OR、NOT 在现实生活中的应用（如两个开关任一按下灯亮 = OR；门锁着且有钥匙才能开 = AND）；小组互评分类是否正确）

### ACTIVITY 8.4 Random numbers（随机数研究）
- **内容 Content**: Is there such a thing as a random number? Research how computers generate random numbers and work out if there is such a thing as a truly random number. Find out why randomness is important in programming and what the potential consequences are of having a system that does not generate random numbers.（研究计算机如何生成随机数、是否存在真正随机的数；随机性在编程中的重要性及无随机性的后果）

### ACTIVITY 8.5 Maintainability check（可维护性检查）
- **内容 Content**: Open a computer program that you have written. Check its maintainability. Edit the program to improve the maintainability. Present your before and after program and explain how you improved its maintainability.（打开自己写过的程序检查可维护性，修改以改善（有意义的标识符、注释、子程序），展示修改前后并解释）

### PROGRAMMING TASK 8.1 User registration（用户注册程序）
- **内容 Content**: A program asks the user to register for a new account. Getting started: list the items the program will collect (name, date of birth, username, etc.) and identify the most appropriate data type for each. Practice: select appropriate variables; write a program to ask the user to enter each item and store it; output a confirmation message. Challenge: the username needs to be at least 8 characters – work out the length of a string input and output how many characters were entered; use selection to check the length and ask for a different username if not long enough.（注册程序：列出收集项并选择合适数据类型，输入并存储、输出确认；挑战：用户名长度检查（length 函数 + 选择语句））

### PROGRAMMING TASK 8.2 Calculator（计算器程序）
- **内容 Content**: A computer program needs writing to act as a calculator: take in two values and a symbol (+, −, * or /), perform that calculation and output the result. Getting started: identify the inputs and appropriate variables; write a program to enter the two numbers and symbol. Practice: discuss which type of selection statement is most appropriate for checking the symbol; edit the program to use it. Challenge: repeatedly ask for the symbol until a valid one is entered; include additional operations (power of, modulus division).（计算器：输入两个数与符号（+、−、*、/），按符号执行计算并输出；挑战：循环直到输入有效符号、增加幂与取余运算）

### PROGRAMMING TASK 8.3 Guess the number（猜数字程序）
- **内容 Content**: A program needs to ask the user to guess what number the game is 'thinking of', continually until they get the correct answer. Getting started: identify inputs/processes/outputs; discuss which constructs (sequence, selection and/or iteration) are needed; plan the algorithm. Practice: write the program; change it so the program outputs "lower" if their guess is too high, and "higher" if too low. Challenge: count how many times the user guesses before getting it correct and output the total; allow a user to enter the number to guess at the start of the program.（猜数字：持续猜测直到正确；提示"lower/higher"；挑战：统计猜测次数、允许开局设定目标数）

### PROGRAMMING TASK 8.4 Noughts and crosses（井字棋游戏）
- **内容 Content**: The 2-player game of noughts and crosses has a grid of 3 squares by 3 squares. Each player takes it in turn to select a box; they cannot select a box that has already been chosen. The first player to get three symbols in a row (horizontally, vertically or diagonally) wins; if the board is full and no-one has won it is a draw. Getting started: decompose into inputs/processes/outputs; discuss how to alternate players and check for a win. Practice: write the program to ask each player to make one move and check for repeated selections; write an algorithm to check if a player has won. Challenge: write a function to check if a player has won (return X, O or C for continue); allow multiple games with alternating first player; let the user select how many games to play and keep track of wins.（井字棋：轮流落子、不能选已占格、三连即胜、满盘为和；挑战：写胜负判断函数（返回 X/O/C）、支持多局并交替先手、记录总胜局）

### PROGRAMMING TASK 8.5 Maths quiz with high score file（数学测验与最高分文件）
- **内容 Content**: A maths quiz game needs to keep a record of the highest number of points players have gained. The quiz is made of randomly generated questions (random numbers and mathematical operation); the user keeps getting new questions until they get one wrong; points equate to the number of questions answered correctly. Getting started: discuss how to randomly generate numbers within bounds (e.g. 1-20) and symbols limited to + − * /; discuss when the file will be read from and written to. Practice: write the program to randomly generate one question, check the answer; amend to repeatedly ask questions until one is incorrect, keeping track of correct answers; amend so when the user gets one wrong, the current high score is loaded from a text file and replaced if beaten. Challenge: store more than one high score (e.g. a top-ten) in a file and rearrange the table.（数学测验：随机出题直到答错，得分 = 答对题数；把最高分存入文本文件，破纪录时更新；挑战：存储并维护前十名榜单）

## 章末 Summary（原文要点，中文辅助）

- A variable is a space in memory, with an identifier, that can store a data item that can change while the program is running. A constant is a space in memory, with an identifier, that can store a data item that cannot change while the program is running.（变量是内存中可存储数据且运行时可改的带标识符空间；常量同样带标识符但运行期间不可改）
- Integer data type stores whole numbers. Real data type stores decimal numbers. Char data type stores a single character. String data type stores a series of characters. Boolean data type stores True or False.（整数存整数、实数存小数、字符存单个字符、字符串存一串字符、布尔存 True/False）
- Input allows the user to enter data into a system. Output allows the program to display data to the user.（输入让用户把数据送入系统；输出让程序向用户显示数据）
- There are three constructs in programming: sequence, selection and iteration.（编程三大结构：顺序、选择与迭代）
- There are two types of selection: IF and CASE. IF statements can include ELSEIF and ELSE.（选择分 IF 与 CASE 两种；IF 可含 ELSEIF 与 ELSE）
- There are three types of iteration: count-controlled loops (a set number of iterations), pre-condition loops (condition is tested before starting the loop) and post-condition loops (condition is tested after completing the code in the loop).（迭代分三种：计数控制（固定次数）、前置条件（先测条件再进循环，可能一次都不执行）、后置条件（先执行再测条件，至少执行一次））
- Totalling requires initialising the total to 0, then adding the values to it. Counting requires initialising the count to 0, then adding 1 to it.（合计需把 total 初始化为 0 再累加；计数需把 count 初始化为 0 再每次加 1）
- Nested statements are when selection/iteration are within a selection/iteration construct.（嵌套语句是一个选择/迭代结构内包含另一个选择/迭代结构）
- Subroutines are self-contained code, with an identifier that can be called from elsewhere in the program. Subroutines reduce repeated code.（子程序是带标识符、可从程序其他地方调用的独立代码块；子程序减少重复代码）
- Subroutines can be procedures (that do not return a value) or functions (that return a value). A parameter is a value sent to a subroutine.（子程序分过程（不返回值）与函数（返回值）；参数是发送给子程序的值）
- Library routines contain pre-written and pre-tested subroutines that can be used in a program.（库例程包含预写且预测试的子程序供程序使用）
- A maintainable program includes meaningful identifiers, addition of comments and subroutines.（可维护程序包含有意义的标识符、注释与子程序）
- An array allows a set of data, of the same data type, to be stored under one identifier. Each element in an array has an index. This might start at 0 or 1 depending on your language.（数组把同类型的多个数据存于一个标识符下；每个元素有下标，从 0 或 1 开始取决于语言）
- An array can be 1-dimensional (one index) or 2-dimensional (two indices). Iteration can be used to read data to, or from an array, by visiting each index in turn.（数组可分一维（一个下标）与二维（两个下标）；可用迭代逐个访问下标来读写数组）
- Files can be used to store data once a program has finished running. File handling: OPEN filename, READ/WRITE data, CLOSE filename.（程序结束后数据可存入文件；文件处理：打开文件 → 读/写数据 → 关闭文件）

## 自查清单（SELF-EVALUATION，原文）

- Use variables and constants（8.1）
- Learn about the appropriate use of basic data types（8.2）
- Write programs that use input and output（8.3）
- Write programs that use sequence, selection and iteration including nested statements（8.5, 8.6, 8.7, 8.11）
- Write programs that use arithmetic, logical and Boolean operators（8.4）
- Write programs that use totalling and counting（8.8, 8.9）
- Write programs that perform the string handling methods（8.10）
- Write programs that use purpose of procedures and functions, including parameters and variable scope（8.12）
- Write programs using library routines（8.13）
- Create maintainable programs（8.14）
- Understand the use of arrays (1-dimensional and 2-dimensional) as data structures（8.15）
- Write programs to read data from and write data to a file（8.16）
