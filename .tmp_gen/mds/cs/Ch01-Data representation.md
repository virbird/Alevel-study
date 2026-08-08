# Ch01 · Data representation（数据表示）

> 来源：Computer Science for Cambridge IGCSE & O Level Coursebook（Sarah Lawrey & Victoria Ellis，2nd ed）Chapter 1 正文
> 内容依据教材原文整理；定义取自教材 KEY WORDS 框，以课本为准；中文对照为辅助翻译。
> 配套 PDF：分章节/Ch01-Data representation.pdf

## 学习目标（Learning intentions 原文，中文辅助）

- learn why computers use binary to process data（学习计算机为何用二进制处理数据）
- develop an understanding about how binary is used to represent different forms of data, such as text, sound and images（理解二进制如何表示文本、声音、图像等不同类型的数据）
- learn to convert between the number systems denary, binary and hexadecimal（学习十进制、二进制与十六进制之间的转换）
- learn to add two binary numbers and understand what is meant by overflow（学习两个二进制数相加并理解什么是溢出）
- learn to perform a binary shift and how this affects the number（学习执行二进制移位及其对数值的影响）
- learn to use two's complement to represent negative binary numbers（学习用补码表示负二进制数）
- learn how the file size of data is measured（学习数据文件大小的计量）
- learn how and why data is compressed（学习数据如何压缩及为何压缩）

## 关键词与原文定义（KEY WORDS）

| 关键词 (EN) | 原文定义（教材 KEY WORDS 框） | 中文对照 |
|-------------|--------------------------|----------|
| analogue data | A continuous stream of data that is processed by humans. | 模拟数据 |
| digital data | Discrete data that only uses the values 0 and 1. | 数字数据 |
| logic gate | A very small component in a computer system that controls the flow of electricity. | 逻辑门 |
| register | A small component in a computer system that is used to temporarily store data. | 寄存器 |
| denary | A base-10 number system that uses the values 0-9. | 十进制 |
| binary | A base-2 number system that uses the values 0 and 1. | 二进制 |
| hexadecimal | A base-16 number system that uses the values 0-9 and characters A-F. | 十六进制 |
| MAC address | A unique address that is given to a computer at the manufacturing stage that can be used to identify the computer. | MAC 地址 |
| overflow error | A type of error that occurs when a number larger than a register can store is generated. | 溢出错误 |
| character set | It contains all the characters that are in that character set and the binary value that is assigned to each character. | 字符集 |
| pixel | A very small dot of colour that is displayed with many others to create an image. | 像素 |
| resolution | The dimensions of an image. | 分辨率 |
| metadata | Additional data that is stored with an image that can provide information such as the dimensions of the image and the time and date the image was taken. | 元数据 |
| colour depth | The number of bits that are used to create each colour in an image. | 颜色深度 |
| sound sampling | A little piece of sound that is recorded at regular time intervals. | 声音采样 |
| sample rate | The number of samples recorded each second. | 采样率 |
| sample resolution | The number of bits that are used to record each sound sample. | 采样分辨率 |
| compression | A method that uses an algorithm to reduce the size of a file. | 压缩 |
| lossy | A compression method that reduces the size of a file by permanently removing data. | 有损压缩 |
| lossless | A compression method that reduces the size of a file by temporarily altering the data. | 无损压缩 |
| perceptual music shaping | A process that is used in lossy compression that removes sounds that are not normally heard by the human ear. | 感知音乐整形（去除人耳听不到的声音） |
| run length encoding (RLE) | An algorithm that groups together repeating patterns and indexes them. | 游程编码 |

## 技能重点（SKILLS FOCUS，需掌握的重要能力）

### SKILLS FOCUS 1.1 Converting between denary and binary numbers（十进制与二进制互转）
- **内容 Content**: The size of a binary number is referred to by the number of bits it has (4-bit, 8-bit, up to 16-bit values you need to understand). To convert denary to binary: write down the binary units from the highest power of 2 (e.g. 8, 4, 2, 1 for 4-bit; 128…1 for 8-bit); compare the denary number with each unit – if it is equal to or greater than the unit, write 1 and subtract the unit; otherwise write 0. Example: 13 → 1101 (8+4+1); 150 → 10010110. To convert binary to denary: add together all the units that have a 1 beneath them (e.g. 1010 = 8+2 = 10). Quick check: if the denary number is odd, the last (rightmost) binary digit should be 1; if even, it should be 0.（二进制位数由 bit 数决定（需理解最多 16 位）；十进制转二进制：写出 2 的幂单位（4 位：8,4,2,1；8 位：128…1），从大到小比较——大于等于该单位记 1 并相减，否则记 0；二进制转十进制：把有 1 的单位相加；奇偶快速校验：十进制为奇数则末位为 1）
- **要点 Key points**: 位权从右向左按 2 的幂递增；每次使用单位后要相减；8 位最大可表示 255（中文要点）

### SKILLS FOCUS 1.2 Converting between denary numbers and hexadecimal（十进制与十六进制互转）
- **内容 Content**: To convert denary to hexadecimal, it is easier to convert to binary first: convert the denary number to 8-bit binary, then split it into two 4-bit binary numbers (each hexadecimal symbol only uses 4 bits), convert each 4-bit group to its hexadecimal symbol (0-9, A-F). Example: 201 → 11001001 → C9. To convert hexadecimal to binary: convert each symbol to its 4-bit binary value (E = 14 = 1110); to get denary, add the units of the binary number (e.g. 5E → 01011110 → 64+16+8+4+2 = 94).（十进制转十六进制：先转二进制，再把 8 位二进制拆成两个 4 位组，各组转对应十六进制符号；十六进制转二进制：每个符号转 4 位二进制，再相加得十进制）
- **要点 Key points**: 十六进制用 A-F 表示 10-15，每个符号只需一个字符；每个十六进制符号恰好对应 4 个二进制位（中文要点）

### SKILLS FOCUS 1.3 Using two's complement to represent negative numbers（用补码表示负数）
- **内容 Content**: Binary cannot use a minus symbol (-) in front of a number as that symbol does not exist in binary, so a method called two's complement is used to represent negative binary numbers; most modern computers use this method. The method is simple: first invert all the values in the binary number (change the 1s to 0s and the 0s to 1s), then add 1 to the result. Example: -35 → 35 in 8-bit binary = 00100011; invert → 11011100; add 1 → 11011101, so 11011101 is the binary representation of -35 using two's complement. The most significant bit (leftmost) indicates the sign: 1 = negative, 0 = positive.（二进制中不能加负号（-），因此用补码表示负数，现代计算机普遍使用此法。方法：先把所有位取反（1 变 0、0 变 1），再加 1。例：-35 → 35 的 8 位二进制为 00100011 → 取反得 11011100 → 加 1 得 11011101，即 -35 的补码表示；最高位（最左位）是符号位：1 为负、0 为正）
- **要点 Key points**: 补码步骤两步：取反 + 加 1；正数补码与原码相同（最高位 0）；负数补码最高位必为 1（中文要点）

### SKILLS FOCUS 1.4 Calculating the size of a file（计算文件大小）
- **内容 Content**: Image file size: width × height × colour depth × number of images (e.g. 10 images, resolution 100 × 150, 8-bit colour: 100 × 150 × 8 × 10 = 1 200 000 bits; divide by 8 for bytes (150 000), divide by 1024 for KiB (146.5 KiB), and by 1024 repeatedly for MiB/GiB). Sound file size: sample rate × sample resolution × length of soundtrack (e.g. 44 100 Hz × 8 bits × 30 s = 10 584 000 bits = 1 323 000 bytes = 1.3 MiB).（图像文件大小 = 宽 × 高 × 颜色深度 × 图像数；声音文件大小 = 采样率 × 采样分辨率 × 时长；按 8 转字节、按 1024 转 KiB/MiB/GiB）
- **要点 Key points**: 单位换算：1 nibble = 4 bits，1 byte = 8 bits，1 KiB = 1024 B，1 MiB = 1024 KiB，1 GiB = 1024 MiB，1 TiB = 1024 GiB，1 PiB = 1024 TiB，1 EiB = 1024 PiB（中文要点）

## 活动与编程任务（ACTIVITY，英文原文为主、中文辅助）

### ACTIVITY 1.1 Uses of hexadecimal（十六进制的用途）
- **内容 Content**: Each computer has a MAC address. This MAC address is written in hexadecimal. This is one of the ways that hexadecimal is used in computer science. Use the internet to find three more uses of hexadecimal in computer science.（每台计算机有 MAC 地址，以十六进制书写；上网查找十六进制在计算机科学中的另外三种用途）

### ACTIVITY 1.2 ASCII and Unicode character sets（ASCII 与 Unicode 字符集）
- **内容 Content**: Use the internet to find an example of an ASCII character set and a Unicode character set. What kind of different characters are represented? Are upper and lowercase letters the same? Using the ASCII table, try to decode the given binary message (each letter is an 8-bit binary number); try writing a message for your friend to decode.（上网查找 ASCII 与 Unicode 字符集示例，比较表示的字符种类与大小写；用 ASCII 表解码二进制消息，并为朋友编写待解码消息）

### ACTIVITY 1.3 RGB colour scale（RGB 颜色标度）
- **内容 Content**: Use the internet to find an RGB colour scale. Each colour in the scale is first presented as hexadecimal: the first two hexadecimal values are the amount of red, the second two the amount of blue and the last two the amount of green. Practise your hexadecimal to binary conversion by converting your favourite colour to its binary value.（上网查找 RGB 颜色标度：十六进制前两位为红色量、中间两位为蓝色量、后两位为绿色量；练习把喜欢的颜色转为二进制）

### ACTIVITY 1.4 Run length encoding（游程编码练习）
- **内容 Content**: Try creating a simple image and writing out the RLE data for it (e.g. 12W, 3Y, 5W… where W = white, Y = yellow, R = red, G = green). Give it to your friend, along with the image resolution, and they can try to recreate your image. Peer assessment: ask your friend whether you got the RLE correct, if you could have made it clearer, and if you missed any important data.（创建简单图像并写出其 RLE 编码数据，连同分辨率交给朋友重建；互相评估 RLE 是否正确、是否清晰、是否遗漏重要数据）

## 章末 Summary（原文要点，中文辅助）

- Computers require any data to be converted to binary before it can be processed by the computer.（计算机处理任何数据前都必须先转换为二进制）
- Different number systems exist such as denary, binary and hexadecimal.（存在十进制、二进制、十六进制等不同数制）
- Hexadecimal is used in computer science for uses such as aiding programmers and representing MAC addresses.（十六进制用于帮助程序员调试程序和表示 MAC 地址等）
- Binary numbers can be added using four rules. If this creates a result greater than 255 for 8-bit binary numbers, an overflow error occurs.（二进制加法有四条规则；8 位二进制相加结果大于 255 时产生溢出错误）
- Logical binary shifts can be performed on binary numbers. These can shift left or shift right and can be done multiple times. This changes the binary number and can affect the accuracy of the binary number.（逻辑移位可左移或右移并可多次执行；会改变二进制数并可能影响精度）
- Text is converted to binary using a character set such as ASCII or Unicode.（文本用 ASCII 或 Unicode 等字符集转换为二进制）
- Images are converted to binary by taking each pixel and providing it with a colour code that is converted to a binary value. The larger the resolution and colour depth of an image, the greater the amount of data that will need to be stored in the image file. This also increases the quality of the image.（图像逐像素赋颜色码并转二进制；分辨率与颜色深度越大，文件数据量越大、图像质量越高）
- Sound is converted to binary by sampling the sound at a set time interval. The value of each sound sample is converted to binary. The greater the sample rate and resolution of the sound, the greater the amount of data that will need to be stored in the sound file. This also increases the accuracy of the recording.（声音按设定时间间隔采样并转二进制；采样率与采样分辨率越大，文件数据量越大、录音精度越高）
- Data is measured in different units such as bits, bytes and mebibytes.（数据用 bit、byte、MiB 等单位计量）
- Data can be compressed, using lossy or lossless compression, to reduce the size of a file. This means it will take up less storage space and it can be quicker to transmit the file.（可用有损或无损压缩减小文件大小：占用更少存储空间、传输更快）

## 自查清单（SELF-EVALUATION，原文）

- Explain why data needs to be converted to binary to be processed by a computer（1.1）
- Convert between denary numbers and binary numbers（1.1）
- Convert between denary numbers and hexadecimal（1.1）
- Convert between binary numbers and hexadecimal（1.1）
- Provide examples of the use of hexadecimal in computer science（1.1）
- Explain why hexadecimal is used in computer science（1.1）
- Add two 8-bit binary numbers（1.2）
- Explain what is meant by an overflow error（1.2）
- Perform a logical binary shift on a binary number, including left and right shifts and multiple shifts（1.2）
- Use two's complement to represent negative numbers（1.2）
- Explain how character sets are used by a computer to represent text（1.3）
- Explain how pixels are used by a computer to create images（1.3）
- Explain how the file size of an image is affected by the image resolution and colour depth（1.3）
- Explain how a sound wave is sampled by a computer（1.3）
- Explain how the file size of a sound recording is affected by the sample rate and sample resolution（1.3）
- Understand how the size of a data file is measured（1.4）
- Calculate the size of an image file（1.4）
- Calculate the size of a sound file（1.4）
- Understand the need for data compression and the effect it has on a file（1.5）
- Explain how different types of data are compressed using lossy compression（1.5）
- Explain how different types of file are compressed using lossless compression（1.5）
