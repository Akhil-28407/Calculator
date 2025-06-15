try:
    print("\nGreetings! This is created by @Akhil-28407\n\n")

    print("Welcome to the Simple Calculator!\n\n")

    a = int(input("Enter first number: "))
    b = int(input("Enter second number: "))

    print("What kind of operation would you like to perform?")

    print(""" press + for addition\n press - for subtraction\n press * for multiplication\n press / for division\n press // for b/a""")

    operation = input("Enter your choice of operation: ")
    match operation:
        case '+':
            print(f"The Addition of {a} and {b} is: {a + b}")
        case '-':
            print(f"The Subtraction of {a} and {b} is: {a - b}")
        case '*':
            print(f"The Multiplication of {a} and {b} is: {a * b}")
        case '/':
            if b != 0:
                print(f"The Division of {a} and {b} is: {a / b}")
            else:
                print("Error: Division by zero is not allowed.")
        case '//':
            if a != 0:
                print(f"The Division of {b} and {a} is: {b/a}")
            else:
                print("Error: Division by zero is not allowed.")
        case _:
            print("\nInvalid operation. Please choose +, -, *, or /.")


except ValueError:
    print("\nInvalid input. Please enter a valid number.")
