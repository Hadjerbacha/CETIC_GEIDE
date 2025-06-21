import java.io.ObjectInputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;

public class P4 {
	public static void main(String[] args) {
		try {
		/*TCP Socket :*/
			/*Serveur ==> reçoir */
			ServerSocket ss= new ServerSocket(2002);
			/*Etablir un connexion pour accepter :*/
			Socket con = ss.accept();
			/*Flux d'entree : */
			ObjectInputStream in = new ObjectInputStream(con.getInputStream());
			String N = (String) in.readObject(); /*Reçoir de P3*/
			String M = (String) in.readObject(); /*Reçoir de P3*/
			String rep = (String) in.readObject(); /*Reçoir de P3*/
			System.out.println("N reçoir par P3 = "+N);
			System.out.println("M reçoir par P3 = "+M);
			if (rep == "true") {
				System.out.println(N+ " et " +M+" sont amicaux "); 			
			}else System.out.println(N+ " et " +M+" ne sont pas amicaux "); 
			
			int P = Integer.parseInt(N) * Integer.parseInt(M); 
			int S = Integer.parseInt(N) + Integer.parseInt(M); 
			System.out.println("Produit N * M = "+P);
			System.out.println("Les nombres cubiques de trois chiffres :");
        	/*UDP Socket - Client send -*/
			DatagramSocket c1 = new DatagramSocket();
			byte[] sendData2 = new byte[40];
			byte[] sendData3 = new byte[40];
			/*Reçcoir les bytes : */
			sendData2 = rep.getBytes();
			sendData3 = M.getBytes();
			/*Creation des packets*/
			DatagramPacket p2 = new DatagramPacket(sendData2,sendData2.length,InetAddress.getByName("Localhost"),1099);
			DatagramPacket p3 = new DatagramPacket(sendData3,sendData3.length,InetAddress.getByName("Localhost"),1099);
			/*Envoyer les packets */
			c1.send(p2);//send rep 
			c1.send(p3);//send M 
            int cpt = 0; // Compteur de nombres cubiques
            for (int i = 100; i <= 999 && i <= S; i++) {
                int u = i % 10; 
                int d = (i / 10) % 10; 
                int c = (i / 100) % 10; 
                if ((u * u * u + c * c * c + d * d * d) == i) {
                    System.out.println(i);
                    /*Convert Integer to String to can send it (getBytes works with String)*/
                	String msg = Integer.toString(i);
        			byte[] sendData1 = new byte[40];
        			/*Reçcoir les bytes : */
        			sendData1 = msg.getBytes();
        			/*Creation des packets*/
        			DatagramPacket p1 = new DatagramPacket(sendData1,sendData1.length,InetAddress.getByName("Localhost"),1099);
        			/*Envoyer les packets */
        			c1.send(p1); //send N1
                    cpt++;
                }
                if (cpt == 0) {System.out.println("None!");} 
                	else System.out.println("Total de nombres cubiques trouvés : " + cpt);
            }	
            
            c1.close();

			in.close();
			con.close();
			ss.close();
		} catch (Exception e) {
			System.out.println("Exception : "+e.toString());
		}
	}

}
