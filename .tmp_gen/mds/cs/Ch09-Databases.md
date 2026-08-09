# Ch09 · Databases（数据库）

> 来源：Computer Science for Cambridge IGCSE & O Level Coursebook（Sarah Lawrey & Victoria Ellis，2nd ed）Chapter 9 正文
> 内容依据教材原文整理；定义取自教材 KEY WORDS 框，以课本为准；中文对照为辅助翻译。
> 配套 PDF：分章节/Ch09-Databases.pdf

## 学习目标（Learning intentions 原文，中文辅助）

- learn about the structure and components of a single-table database（学习单表数据库的结构与组成）
- identify the fields necessary for a single-table database（识别单表数据库所需的字段）
- understand the type of data each of the basic data types represent（理解每种基本数据类型表示的数据类型）
- identify appropriate data types for specific data and fields（为特定数据与字段识别合适的数据类型）
- describe the purpose and/or need for a primary key in a table（描述表中主键的作用/必要性）
- identify an appropriate primary key for a table（为表识别合适的主键）
- understand the purpose of SQL scripts（理解 SQL 脚本的作用）
- read and complete SQL scripts that use SELECT FROM（阅读并完成使用 SELECT FROM 的 SQL 脚本）
- read and complete SQL scripts that use SELECT FROM WHERE（阅读并完成使用 SELECT FROM WHERE 的 SQL 脚本）
- read and complete SQL scripts that use ORDER BY（阅读并完成使用 ORDER BY 的 SQL 脚本）
- read and complete SQL scripts that use SUM（阅读并完成使用 SUM 的 SQL 脚本）
- read and complete SQL scripts that use COUNT（阅读并完成使用 COUNT 的 SQL 脚本）

## 关键词与原文定义（KEY WORDS）

| 关键词 (EN) | 原文定义（教材 KEY WORDS 框） | 中文对照 |
|-------------|--------------------------|----------|
| database | An example of application software to store and manipulate data. | 数据库 |
| table | A set of data about one type of object, e.g. students. | 表 |
| field | An individual piece of data, e.g. date of birth. | 字段 |
| record | All of the records in a table about one object, e.g. all the personal details about one student. | 记录 |
| data type | The characteristics of a piece of data. Common data types are string, integer, real and Boolean. | 数据类型 |
| Boolean | A data type. True or False. | 布尔 |
| integer | A data type. Whole numbers. | 整数 |
| real | A data type. Decimal numbers. | 实数 |
| primary key | A unique identifier for a record. | 主键 |
| Structured Query Language (SQL) | A standard language used to define and manipulate databases. | 结构化查询语言 |
| script | A set of statements that are executed. | 脚本 |
| logical operator | A symbol that performs a comparison resulting in True or False. Can be equals, not equal to, less than, less than or equal to, greater than, greater than or equal to. | 逻辑运算符 |
| Boolean operator | A symbol that joins multiple logical comparisons, can be AND, OR or NOT. | 布尔运算符 |

## 技能重点（SKILLS FOCUS，需掌握的重要能力）

### SKILLS FOCUS 9.1 SUM and COUNT（SUM 与 COUNT 的区别）
- **内容 Content**: SUM and COUNT are both mathematical operations that perform different functions. SUM performs addition of a group of values: e.g. 1 + 3 + 8 + 9 + 3 = 24; in SQL, SELECT SUM(Total) FROM SALES adds together the Total column (20.00 + 16.25 + 8.99 + 3.00 + 11.50 = 59.74); with a WHERE condition, only the matching records are added (SELECT SUM(Total) FROM SALES WHERE Customer ID = "2" → 16.25 + 3.00 = 19.25). COUNT counts the number of records (rows) – not related to the values in the fields: SELECT COUNT(Total) FROM SALES → 5 (five records); with criteria, SELECT COUNT(Total) FROM SALES WHERE Customer ID = "2" → 2. When answering "what does this script return?", the only answer is the number.（SUM 把一组值相加：SQL 中 SELECT SUM(字段) FROM 表 把该列数值相加，WHERE 条件限定只加符合条件的记录；COUNT 统计记录（行）数量——与字段值无关，只数符合条件的记录数；回答"脚本返回什么"时只写数字）
- **要点 Key points**: SUM 返回数值总和（可能与字段值有关）；COUNT 返回记录条数（整数）；两者都可与 WHERE 组合（中文要点）

### SQL 语法注意事项（SQL syntax notes）
- **内容 Content**: The field names and table name must be exact – SQL is case sensitive (if the field is 'Genre', putting 'genre' is incorrect). Multiple fields are separated by commas (,), with no comma after the last field; each record is returned on a new line; the order the fields appear in the query determines the order of the returned data. WHERE conditions use logical operators (=, <, <=, >, >=, <>) and can combine conditions with Boolean operators AND/OR. ORDER BY comes after SELECT ... FROM (or WHERE) and can be ASC (ascending, default) or DESC (descending).（字段名与表名必须完全一致——SQL 区分大小写；多字段用逗号分隔，最后一个字段后不加逗号；每条记录占一行；返回字段顺序与查询中的顺序一致；WHERE 用逻辑运算符，多条件用 AND/OR 组合；ORDER BY 放在 FROM/WHERE 之后，可 ASC（默认升序）或 DESC（降序））
- **要点 Key points**: 大小写敏感是常错点；SELECT 的字段可以不同于 WHERE 中使用的字段（中文要点）

## 活动与编程任务（ACTIVITY / PROGRAMMING TASK，英文原文为主、中文辅助）

### ACTIVITY 9.1 School database fields（学校数据库字段）
- **内容 Content**: Consider your school. In pairs identify the fields that your school will store about you. Write a list of the fields. Compare your pair's answers with another pair. Were there any differences? Did you add any more to your list?（两人一组列出学校会存储的关于你的字段清单，与其他组比较差异并补充）

### ACTIVITY 9.2 Other SQL mathematical functions（其他 SQL 数学函数）
- **内容 Content**: There are other mathematical functions that SQL can perform. Find at least one other example of a mathematical function and how to write an SQL script using it. Take one of the example databases and write a script using your function. Peer assessment: swap your new function and script with a partner, research their function and check whether their script is accurate.（查找 SQL 的其他数学函数（如 AVG、MIN、MAX 等）并写脚本应用；与同伴互换检查脚本是否正确）

### PROGRAMMING TASK 9.1 Defining a single-table database（定义单表数据库）
- **内容 Content**: A clothes store needs a single-table database to store data about its stock: barcode of each item, name of the product, colour, size, quantity in stock and whether an order for more products has been made or not. Getting started: explain what is meant by a record and a field; identify four data types and describe the data they store; identify what is meant by a primary key. Practice: identify the fields, the data types, and the primary key for your table; create a paper-based table and complete several records. Challenge (beyond spec): open database software (e.g. Microsoft Access), find out how to create a table and add data, and create the database.（为服装店库存定义单表数据库：确定字段（条形码、品名、颜色、尺码、库存量、是否已补货）、数据类型与主键，并制作纸质表填写记录；挑战：用 Access 等软件实际建表）
- **要点 Key points**: 定义单表数据库三步：①确定字段 ②为每字段选数据类型 ③确定主键；没有字段唯一时需新增 ID 字段作主键（中文要点）

### PROGRAMMING TASK 9.2 SQL queries（SQL 查询练习）
- **内容 Content**: Use your shop database table from Programming Task 9.1. Getting started: identify the command words in an SQL search script; identify four logical operators and describe the function of each; identify two Boolean operators and describe the function of each. Practice: 1a complete SELECT ... FROM to return the name of all products; 1b identify the values returned; 2a complete SELECT ... FROM ... WHERE to return names of products where an order for more products has been made; 2b identify values; 3a complete a query returning barcode, colour and size where quantity in stock is less than 10 AND an order has not been made; 3b identify values. Challenge (beyond spec): write and run the queries in database software.（基于商店表完成 SQL：SELECT FROM、SELECT FROM WHERE（单条件与 AND 多条件）、识别返回结果）

### PROGRAMMING TASK 9.3 ORDER BY, SUM and COUNT（排序与统计查询）
- **内容 Content**: Use your shop database table from Programming Task 9.1. Getting started: identify the commands to order a query in descending order (ORDER BY ... DESC); to add together a set of values (SUM); to count how many records there are (COUNT). Practice: 1 complete SELECT ... ORDER BY Quantity in stock DESC; 2 complete SELECT SUM(...) to return the total cost of all products; 3 complete SELECT COUNT(...) WHERE to return how many items have been ordered for more products; 4 complete a query returning how many items are red AND have more than 100 in stock, in ascending order by number in stock. Challenge (beyond spec): execute the queries in your database.（练习 ORDER BY（ASC/DESC）、SUM、COUNT 以及 AND 多条件组合查询）

## 章末 Summary（原文要点，中文辅助）

- A database stores data about objects such as items, people, orders.（数据库存储关于物品、人、订单等对象的数据）
- A field is one piece of data in a table. A record is a set of fields about one object.（字段是表中的一条数据；记录是关于一个对象的一组字段）
- Each field has a data type.（每个字段有数据类型）
- The text or alphanumeric data type stores any combination of letters, numbers and symbols. The character data type stores one letter, number or symbol. The Boolean data type stores one of two values, either True or False. The Integer data type stores whole numbers. The real data type stores decimal numbers. The date/time data type can store a date, time, or a date and time.（文本/字母数字类型存字母数字符号组合；字符类型存单个字符；布尔存 True/False；整数存整数；实数存小数；日期/时间存日期、时间或二者）
- A primary key is a unique identifier in a table. A primary key is used to uniquely identify each record.（主键是表中的唯一标识符，用于唯一标识每条记录）
- SQL stands for Structured Query Language and is a standard for querying databases.（SQL 即结构化查询语言，是数据库查询的标准）
- SELECT ... FROM returns all the data in the field given.（SELECT ... FROM 返回给定字段的全部数据）
- SELECT ... FROM ... WHERE returns all the data in the field where the WHERE condition is true.（SELECT ... FROM ... WHERE 返回 WHERE 条件为真的字段数据）
- ORDER BY can be ASC (ascending) or DESC (descending) and will return the data in the order specified by the field given.（ORDER BY 可 ASC（升序）或 DESC（降序），按给定字段顺序返回数据）
- SUM will total the values in the given field. COUNT will return how many records meet the criteria.（SUM 求给定字段数值总和；COUNT 返回符合条件的记录数）

## 自查清单（SELF-EVALUATION，原文）

- Learn about the structure and components of a single-table database（9.1）
- Identify the fields necessary for a single-table database（9.1）
- Identify appropriate data types for specific data and fields（9.1）
- Identify an appropriate primary key for a table（9.1）
- Understand the purpose of SQL scripts（9.2）
- Read and complete SQL scripts that use SELECT FROM（9.3）
- Read and complete SQL scripts that use SELECT FROM WHERE（9.4）
- Read and complete SQL scripts that use ORDER BY（9.5）
- Read and complete SQL scripts that use SUM（9.6）
- Read and complete SQL scripts that use COUNT（9.7）
