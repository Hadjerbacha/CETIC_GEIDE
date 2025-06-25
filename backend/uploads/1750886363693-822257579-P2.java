import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.net.ServerSocket;
import java.net.Socket;

public class P2 {

    public static void main(String[] args) {
        try {
            // Receive N from P1
            ServerSocket s = new ServerSocket(2002);
            Socket con = s.accept();
            ObjectInputStream InP2 = new ObjectInputStream(con.getInputStream());
            int N = (int) InP2.readObject();
            System.out.println("N received from P1: " + N);
            InP2.close();
            con.close();
            s.close();

            // Multiply by 2 and send to P3
            int N2 = 2 * N;
            Socket c = new Socket("localhost", 2003);
            ObjectOutputStream outP2 = new ObjectOutputStream(c.getOutputStream());
            outP2.writeObject(N2);
            outP2.close();
            c.close();

            // Receive the result from P3
            ServerSocket s2 = new ServerSocket(2005);
            Socket con2 = s2.accept();
            ObjectInputStream inP2FromP3 = new ObjectInputStream(con2.getInputStream());
            int N3 = (int) inP2FromP3.readObject();
            System.out.println("Result received from P3: " + N3);
            inP2FromP3.close();
            con2.close();
            s2.close();

            // Send final result to P1
            Socket backToP1 = new Socket("localhost", 2001);
            ObjectOutputStream outP2ToP1 = new ObjectOutputStream(backToP1.getOutputStream());
            outP2ToP1.writeObject(N3);
            outP2ToP1.close();
            backToP1.close();

            // Notify P4
            Socket notifyP4 = new Socket("localhost", 2004);
            ObjectOutputStream outNotifyP4 = new ObjectOutputStream(notifyP4.getOutputStream());
            outNotifyP4.writeObject("P2 sent result to P1: " + N3);
            outNotifyP4.close();
            notifyP4.close();
        } catch (Exception e) {
            System.out.println(e.toString());
        }
    }
}
