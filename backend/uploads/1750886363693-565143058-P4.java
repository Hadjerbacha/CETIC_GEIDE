import java.io.ObjectInputStream;
import java.net.ServerSocket;
import java.net.Socket;

public class P4 {

    public static void main(String[] args) {
        try {
            // Wait for notifications from P2 and P3
            ServerSocket s = new ServerSocket(2004);
            while (true) {
                Socket con = s.accept();
                ObjectInputStream InP4 = new ObjectInputStream(con.getInputStream());
                String notification = (String) InP4.readObject();
                System.out.println("Notification received in P4: " + notification);
                InP4.close();
                con.close();
            }
        } catch (Exception e) {
            System.out.println(e.toString());
        }
    }
}
