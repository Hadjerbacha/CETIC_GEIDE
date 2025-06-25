import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.net.ServerSocket;
import java.net.Socket;

public class essai {//p2 receive p1 p2 send to p3 p2 receive p3 p2 send p1
    
    public static void main(String[] args) { 
      
        try{
            ServerSocket SS =new ServerSocket(2002);
            Socket con = SS.accept();
            ObjectInputStream inputFromP1 = new ObjectInputStream(con.getInputStream());
            int N = (int) inputFromP1.readObject();
            System.out.println("le nombre est: "+ N  );
            inputFromP1.close();
            con.close();
            SS.close();
            

            int N2 = N*2;
            //2eme fois ouvrir le servr pour envoyer a p3 
            Socket SendP3 =new Socket('localhost',2001);
            ObjectOutputStream outputP3 = new ObjectOutputStream(SendP3.getOutputStream());
            outputP3 = writeObject(N2);

            //recevoir mn p3
            Socket SendP3 =new Socket('localhost',2001);
            ObjectInputStream inputP3 = new ObjectInputStream(SendP3.getInputStream());
            inputP3 = writeObject(N2);

        }


        catch (Exception e) {
            System.out.println(e.toString());
        }
    }
}