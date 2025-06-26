import java.io.ObjectOutputStream;  // Import for sending objects over a network
import java.io.ObjectInputStream;   // Import for receiving objects over a network
import java.net.Socket;              // Import for creating socket connections
import java.util.Scanner;            // Import for capturing user input

public class P1 {                    // Define the class P1
    public static void main(String[] args) {  // Main method, entry point of the program
        try {
            // Prompt the user to enter an integer N
            Scanner sc = new Scanner(System.in);  // Create a Scanner object to read input
            System.out.println("N =");              // Display prompt message
            int N = sc.nextInt();                  // Read the integer input from the user

            // Create a socket to connect to P2 for sending N
            Socket c = new Socket("localhost", 2002);  // Connect to localhost on port 2002
            ObjectOutputStream outP1 = new ObjectOutputStream(c.getOutputStream());  // Create an output stream for sending data
            outP1.writeObject(N);  // Send the integer N to P2
            outP1.close();          // Close the output stream
            sc.close();            // Close the scanner
            c.close();             // Close the socket

            // Create a new socket to receive the result from P2
            Socket socketFromP2 = new Socket("localhost", 2001);  // Connect to localhost on port 2001
            ObjectInputStream inP1 = new ObjectInputStream(socketFromP2.getInputStream());  // Create an input stream for receiving data
            int result = (int) inP1.readObject();  // Read the result sent back from P2 and cast it to an integer
            System.out.println("Final Result received from P2: " + result);  // Display the received result
            inP1.close();           // Close the input stream
            socketFromP2.close();   // Close the socket

        } catch (Exception e) {       // Catch any exceptions that occur
            System.out.println(e.toString());  // Print the exception message
        }
    }
}
