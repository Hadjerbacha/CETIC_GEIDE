import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Socket;
import java.util.Scanner;
import java.io.ObjectOutputStream;

public class P1 {

	public static void main(String[] args) {
		try {
			Scanner sc= new Scanner(System.in);
			System.out.println("Donner N >>");
			String N=sc.next(); /* read the next word  */
		/* TCP Socket: */
			Socket c = new Socket("localhost",2001); /*Client de P2*/
			/* Creation des flux d'information : */
			ObjectOutputStream out = new ObjectOutputStream(c.getOutputStream());
			out.writeObject(N); /*Send N to P2*/	
			
		/* UDP Socket - Serveur reçois -*/
			DatagramSocket c1 = new DatagramSocket(1099);
			/*Reception des packets :*/
			/*Cree tableau des bytes et q packet pour mettre les packet reçu*/
			byte[] receiveData = new byte [40];
			
			DatagramPacket q2= new DatagramPacket(receiveData,receiveData.length);
			c1.receive(q2); // receive rep 
			String rep = new String(q2.getData(), 0, q2.getLength()).trim();
			c1.receive(q2); // receive M
			String M1 = new String(q2.getData(), 0, q2.getLength()).trim(); // pour l'affichage only 
			if (rep == "true") {
				System.out.println(N+ " et " +M1+" sont amicaux "); 			
			}else System.out.println(N+ " et " +M1+" ne sont pas amicaux "); 
			
			System.out.println("Les nombres cubiques de trois chiffres :");
 
			c1.receive(q2); //receive N1 
			String N1 = new String(q2.getData(), 0, q2.getLength()).trim();
			System.out.println("Cubique "+N1);
			
			c1.close();
			out.close();
			c.close();
			sc.close();
		}catch (Exception e) { 
			System.out.println("Exception : "+e.toString());
		}
		
	}
 
}
